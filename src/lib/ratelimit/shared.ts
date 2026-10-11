/**
 * orire — shared (cross-instance) rate-limit backend.
 *
 * The in-memory limiter in `rateLimit.ts` is per-instance, so on a fleet of
 * serverless instances each enforces its own window and a caller spreading
 * requests across instances gets a higher effective limit. When Upstash Redis
 * REST is configured (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN), this
 * backend enforces one shared fixed-window counter across all instances. With
 * no Upstash config it transparently falls back to the in-memory limiter, so
 * nothing changes for local dev or an un-provisioned deploy. A store outage
 * also falls back (fail-safe to per-instance protection rather than an outage).
 *
 * Uses the Upstash REST API over fetch — no new dependency, no persistent
 * connection (correct for serverless).
 */

import { checkLimit, type RateLimitResult } from "./rateLimit";
import { logger } from "@/lib/obs/logger";

export function upstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

interface PipelineItem {
  result?: unknown;
  error?: string;
}

/** One shared fixed-window hit via an Upstash REST pipeline (INCR + PEXPIRE NX + PTTL). */
async function upstashFixedWindow(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/+$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const redisKey = `rl:${key}`;

  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    // PEXPIRE ... NX sets the window only on the first hit, so the window is
    // fixed from the first request and later hits don't extend it.
    body: JSON.stringify([
      ["INCR", redisKey],
      ["PEXPIRE", redisKey, windowMs, "NX"],
      ["PTTL", redisKey],
    ]),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);

  const data = (await res.json()) as PipelineItem[];
  const count = Number(data?.[0]?.result ?? NaN);
  if (!Number.isFinite(count) || count <= 0) throw new Error("Upstash: unexpected INCR result");
  const ttl = Number(data?.[2]?.result ?? NaN);
  const resetMs = Number.isFinite(ttl) && ttl > 0 ? ttl : windowMs;
  return { ok: count <= limit, remaining: Math.max(0, limit - count), limit, resetMs };
}

/**
 * Record one hit against `key`. Uses the shared Upstash store when configured,
 * otherwise the in-memory limiter. Never throws: on any Upstash error it logs
 * and falls back to the in-memory limiter.
 */
export async function checkLimitShared(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (!upstashConfigured()) return checkLimit(key, limit, windowMs);
  try {
    return await upstashFixedWindow(key, limit, windowMs);
  } catch (e) {
    logger.warn("ratelimit.shared_fallback", { error: e instanceof Error ? e.message : String(e) });
    return checkLimit(key, limit, windowMs);
  }
}
