/**
 * orire — server-side provider dispatch (Node runtime only).
 *
 * Single point where a system+user prompt is sent to a provider and a text
 * completion comes back over HTTPS to OpenAI / Anthropic with orire's managed
 * key.
 *
 * Resilience (durability P0): every network call is bounded by a timeout
 * (AbortController) and retried a small, fixed number of times on transient
 * failures (network errors, timeouts, HTTP 408/409/425/429/5xx/529). Retries
 * use exponential backoff with jitter and honor a `Retry-After` header when the
 * provider sends one. Non-transient failures (4xx other than 429) return
 * immediately. Without this, one slow or flapping provider stalls a whole run.
 *
 * Every failure path returns the provider's own message VERBATIM (req 12); we
 * never paraphrase provider errors. Timeouts and network drops have no provider
 * message, so we surface a clear, honest description instead.
 */

import { type ProviderId } from "@/lib/ai/types";
import { logger } from "@/lib/obs/logger";
import {
  cacheEnabled,
  cacheKey,
  getCached,
  isCacheable,
  setCached,
} from "@/lib/ai/server/responseCache";

export type ProviderCall =
  | { ok: true; content: string }
  | { ok: false; status?: number; body: string };

export interface CallOpts {
  temperature?: number;
  maxTokens?: number;
  /** OpenAI reproducibility hint. Ignored by providers that don't support it. */
  seed?: number;
}

/**
 * Shared deterministic settings for grounded, reproducible calls (structure /
 * refine / judge / simulate). Temperature 0 removes sampling noise; the fixed
 * seed makes OpenAI best-effort reproducible. Anthropic has no seed param, so
 * temperature 0 is as deterministic as its API allows.
 */
export const DETERMINISTIC: CallOpts = { temperature: 0, seed: 1217 };

// ── Resilience configuration ───────────────────────────────────────────────

/** Injectable dependencies so the retry logic is deterministic under test. */
export interface ResilienceDeps {
  fetchImpl: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
}

export interface ResilienceConfig {
  /** Total attempts including the first (so 3 = 1 try + 2 retries). */
  attempts: number;
  /** Per-attempt timeout in ms before the request is aborted. */
  timeoutMs: number;
  /** Base backoff in ms; grows exponentially per retry. */
  baseDelayMs: number;
  /** Upper bound on any single backoff in ms. */
  maxDelayMs: number;
}

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function defaultResilienceConfig(): ResilienceConfig {
  return {
    attempts: envInt("AI_CALL_MAX_ATTEMPTS", 3),
    timeoutMs: envInt("AI_CALL_TIMEOUT_MS", 60_000),
    baseDelayMs: envInt("AI_CALL_BASE_DELAY_MS", 500),
    maxDelayMs: envInt("AI_CALL_MAX_DELAY_MS", 8_000),
  };
}

const realDeps: ResilienceDeps = {
  fetchImpl: (...args) => fetch(...args),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  random: Math.random,
};

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);

/** Outcome of a single resilient request: an HTTP response or a transport error. */
export type FetchOutcome =
  | { kind: "response"; status: number; text: string }
  | { kind: "error"; message: string };

/** Parse a `Retry-After` header (delta-seconds or HTTP-date) into ms. */
function parseRetryAfter(value: string | null, now: number): number | null {
  if (!value) return null;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - now);
  return null;
}

function backoffMs(attempt: number, cfg: ResilienceConfig, random: () => number): number {
  const exp = cfg.baseDelayMs * 2 ** (attempt - 1);
  const capped = Math.min(exp, cfg.maxDelayMs);
  // Full jitter: spread retries so concurrent failures don't thundering-herd.
  return Math.floor(capped * (0.5 + random() * 0.5));
}

/**
 * POST JSON with timeout + bounded retry. Returns a {@link FetchOutcome}; never
 * throws. The body text is passed back verbatim so callers can honor req 12.
 */
export async function resilientJsonFetch(
  url: string,
  init: RequestInit,
  cfg: ResilienceConfig = defaultResilienceConfig(),
  deps: ResilienceDeps = realDeps,
  meta: { provider?: string; model?: string } = {},
): Promise<FetchOutcome> {
  let lastError = "Request failed.";

  for (let attempt = 1; attempt <= cfg.attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    const started = Date.now();
    try {
      const res = await deps.fetchImpl(url, { ...init, signal: controller.signal });
      const text = await res.text();
      clearTimeout(timer);

      if (res.ok) {
        if (attempt > 1) {
          logger.info("ai.call.recovered", { ...meta, attempt, status: res.status });
        }
        return { kind: "response", status: res.status, text };
      }

      // Non-OK HTTP. Retry only transient statuses, and only if attempts remain.
      if (RETRYABLE_STATUS.has(res.status) && attempt < cfg.attempts) {
        const retryAfter = parseRetryAfter(res.headers.get("retry-after"), Date.now());
        const delay = retryAfter ?? backoffMs(attempt, cfg, deps.random);
        logger.warn("ai.call.retry", {
          ...meta,
          attempt,
          status: res.status,
          delayMs: delay,
          durationMs: Date.now() - started,
        });
        await deps.sleep(delay);
        continue;
      }

      // Terminal HTTP error — hand the body back verbatim.
      return { kind: "response", status: res.status, text };
    } catch (err) {
      clearTimeout(timer);
      const aborted = err instanceof Error && err.name === "AbortError";
      lastError = aborted
        ? `The ${meta.provider ?? "assistant"} request timed out after ${Math.round(
            cfg.timeoutMs / 1000,
          )}s. Please try again.`
        : err instanceof Error
          ? err.message
          : String(err);

      if (attempt < cfg.attempts) {
        const delay = backoffMs(attempt, cfg, deps.random);
        logger.warn("ai.call.retry", {
          ...meta,
          attempt,
          reason: aborted ? "timeout" : "network",
          delayMs: delay,
          durationMs: Date.now() - started,
        });
        await deps.sleep(delay);
        continue;
      }
      logger.error("ai.call.failed", {
        ...meta,
        attempt,
        reason: aborted ? "timeout" : "network",
      });
      return { kind: "error", message: lastError };
    }
  }

  return { kind: "error", message: lastError };
}

// ── Providers ──────────────────────────────────────────────────────────────

/**
 * GPT-5 and the o-series reasoning models only run at their default sampling
 * settings — they reject a custom `temperature` (and `seed`/`top_p`) with
 * "Only the default (1) value is supported." For those models we omit the
 * sampling params entirely; older chat models (gpt-4o, gpt-4.1…) keep them.
 */
function openAIFixedSampling(model: string): boolean {
  return /^(gpt-5|o[1-9])/i.test(model);
}

async function callOpenAI(
  key: string,
  model: string,
  system: string,
  user: string,
  opts: CallOpts,
  deps?: ResilienceDeps,
): Promise<ProviderCall> {
  const fixedSampling = openAIFixedSampling(model);
  const outcome = await resilientJsonFetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        // Reasoning/GPT-5 models only accept the default temperature; sending
        // one errors the whole call, so omit sampling params for them.
        ...(fixedSampling
          ? {}
          : {
              temperature: opts.temperature ?? 0.2,
              ...(opts.seed != null ? { seed: opts.seed } : {}),
            }),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    },
    defaultResilienceConfig(),
    deps ?? realDeps,
    { provider: "openai", model },
  );
  if (outcome.kind === "error") return { ok: false, body: outcome.message };
  if (outcome.status < 200 || outcome.status >= 300) {
    return { ok: false, status: outcome.status, body: outcome.text };
  }
  let data: unknown;
  try {
    data = JSON.parse(outcome.text);
  } catch {
    return { ok: false, status: outcome.status, body: outcome.text };
  }
  const content: string =
    (data as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content ?? "";
  return { ok: true, content };
}

async function callAnthropic(
  key: string,
  model: string,
  system: string,
  user: string,
  opts: CallOpts,
  deps?: ResilienceDeps,
): Promise<ProviderCall> {
  const outcome = await resilientJsonFetch(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 8000,
        temperature: opts.temperature ?? 0.2,
        system,
        messages: [{ role: "user", content: user }],
      }),
    },
    defaultResilienceConfig(),
    deps ?? realDeps,
    { provider: "anthropic", model },
  );
  if (outcome.kind === "error") return { ok: false, body: outcome.message };
  if (outcome.status < 200 || outcome.status >= 300) {
    return { ok: false, status: outcome.status, body: outcome.text };
  }
  let data: unknown;
  try {
    data = JSON.parse(outcome.text);
  } catch {
    return { ok: false, status: outcome.status, body: outcome.text };
  }
  const blocks = (data as { content?: { text?: string }[] })?.content;
  const content: string = Array.isArray(blocks) ? blocks.map((b) => b?.text ?? "").join("") : "";
  return { ok: true, content };
}

/** Dispatch a prompt to the given provider, regardless of transport. */
export async function runProvider(args: {
  provider: ProviderId;
  apiKey?: string;
  model: string;
  system: string;
  user: string;
  opts?: CallOpts;
  /** Test-only: inject fetch/sleep/random for deterministic retry tests. */
  deps?: ResilienceDeps;
}): Promise<ProviderCall> {
  const { provider, apiKey, model, system, user, opts = {}, deps } = args;

  // Deterministic responses are cached to protect the managed-key budget from
  // repeat spend (re-runs, double-clicks, client retries). The cache is skipped
  // for injected-deps (test) calls so provider dispatch stays observable there.
  const cacheable = !deps && cacheEnabled() && isCacheable(opts);
  const key = cacheable ? cacheKey(provider, model, system, user, opts) : "";
  if (cacheable) {
    const cached = getCached(key);
    if (cached !== null) {
      logger.debug("ai.cache.hit", { provider, model });
      return { ok: true, content: cached };
    }
  }

  const out =
    provider === "openai"
      ? await callOpenAI(apiKey ?? "", model, system, user, opts, deps)
      : await callAnthropic(apiKey ?? "", model, system, user, opts, deps);

  if (cacheable && out.ok) setCached(key, out.content);
  return out;
}
