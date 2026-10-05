/**
 * orire — server-side provider dispatch (Node runtime only).
 *
 * Single point where a system+user prompt is sent to a provider and a text
 * completion comes back over HTTPS to OpenAI / Anthropic with the user's BYO key.
 *
 * Every failure path returns the provider's own message VERBATIM (req 12); we
 * never paraphrase provider errors.
 */

import { type ProviderId } from "@/lib/ai/types";

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

async function callOpenAI(
  key: string,
  model: string,
  system: string,
  user: string,
  opts: CallOpts
): Promise<ProviderCall> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.2,
      ...(opts.seed != null ? { seed: opts.seed } : {}),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: text };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, status: res.status, body: text };
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
  opts: CallOpts
): Promise<ProviderCall> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
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
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: text };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, status: res.status, body: text };
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
}): Promise<ProviderCall> {
  const { provider, apiKey, model, system, user, opts = {} } = args;
  if (provider === "openai") return callOpenAI(apiKey ?? "", model, system, user, opts);
  return callAnthropic(apiKey ?? "", model, system, user, opts);
}
