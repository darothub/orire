/**
 * orire — in-memory response cache for deterministic AI calls.
 *
 * Every AI route runs with `DETERMINISTIC` opts (temperature 0 + fixed seed),
 * so the same (provider, model, system, user) inputs are expected to yield the
 * same model output. Caching those results protects the managed-key budget from
 * repeat spend — e.g. a user re-running the same compare, double-clicking, or a
 * client retry — and cuts latency on a hit.
 *
 * Trade-offs (deliberate P0): the cache is per-instance and in-memory (same
 * model as the rate limiter), bounded by a TTL and an entry cap. Only
 * deterministic calls are cacheable; anything with a non-zero temperature is
 * passed straight through. `getCached`/`setCached` are the seam to swap for a
 * shared store (Upstash/Vercel KV) later.
 */

import type { CallOpts } from "@/lib/ai/server/providerCall";
import type { ProviderId } from "@/lib/ai/types";

interface Entry {
  content: string;
  expires: number;
}

const store = new Map<string, Entry>();

const intFromEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Cache is on unless explicitly disabled. */
export function cacheEnabled(): boolean {
  return process.env.AI_CACHE_DISABLED !== "1";
}

function ttlMs(): number {
  return intFromEnv("AI_CACHE_TTL_MS", 10 * 60 * 1000);
}

function maxEntries(): number {
  return intFromEnv("AI_CACHE_MAX", 500);
}

/** Only deterministic calls (temperature 0) may be cached. */
export function isCacheable(opts: CallOpts | undefined): boolean {
  return !!opts && opts.temperature === 0;
}

/** Fast non-cryptographic hash (djb2) to fold large prompts into a short token. */
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Stable key over everything the model output depends on. The system/user
 * prompts (which embed the CV + JD) are hashed; the sampling params are included
 * verbatim so a different seed/temperature/maxTokens never collides.
 */
export function cacheKey(
  provider: ProviderId,
  model: string,
  system: string,
  user: string,
  opts: CallOpts,
): string {
  const params = `t=${opts.temperature ?? ""};s=${opts.seed ?? ""};m=${opts.maxTokens ?? ""}`;
  return `${provider}|${model}|${params}|${djb2(system)}|${djb2(user)}`;
}

/** Return cached content for a key, or null on miss/expiry. */
export function getCached(key: string, now: number = Date.now()): string | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expires <= now) {
    store.delete(key);
    return null;
  }
  return hit.content;
}

/** Store content under a key with the configured TTL, enforcing the size cap. */
export function setCached(key: string, content: string, now: number = Date.now()): void {
  // Evict the oldest entries when at capacity (Map preserves insertion order).
  const cap = maxEntries();
  while (store.size >= cap) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
  store.set(key, { content, expires: now + ttlMs() });
}

/** Test helper: clear all entries. */
export function __resetResponseCache(): void {
  store.clear();
}
