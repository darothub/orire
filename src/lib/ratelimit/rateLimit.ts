/**
 * orire — rate limiting (dependency-free, fixed-window).
 *
 * Protects the managed-key AI routes and the email-sending auth routes from
 * bursts and cost abuse. The AI routes run on orire's own provider keys, so an
 * unthrottled caller spends real money; several of them (structure / simulate /
 * judge / retone) have no auth gate, which makes a limiter essential.
 *
 * This is an IN-MEMORY, per-instance limiter. On a single instance (local dev,
 * a warm serverless container) it is exact; across many serverless instances it
 * is best-effort — each instance enforces its own window. That is a deliberate
 * P0 trade-off: zero new infrastructure, meaningful protection today, and a
 * clean seam (`checkLimit`) to swap for a shared store (Upstash/Vercel KV)
 * later without touching call sites.
 */

export interface RateLimitResult {
  ok: boolean;
  /** Requests still allowed in the current window. */
  remaining: number;
  /** Configured ceiling for the window. */
  limit: number;
  /** Milliseconds until the current window resets. */
  resetMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Cheap opportunistic eviction so the map can't grow without bound. */
function sweep(now: number): void {
  if (buckets.size < 5000) return;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Record one hit against `key` and report whether it is within `limit` per
 * `windowMs`. The first hit of a window starts the clock; the window is fixed
 * (not sliding) for simplicity and predictability.
 */
export function checkLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  sweep(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, limit, resetMs: windowMs };
  }
  existing.count += 1;
  const remaining = limit - existing.count;
  return {
    ok: remaining >= 0,
    remaining: Math.max(0, remaining),
    limit,
    resetMs: Math.max(0, existing.resetAt - now),
  };
}

/** Test-only: clear all buckets. */
export function __resetRateLimits(): void {
  buckets.clear();
}

/**
 * Best-effort client IP from standard proxy headers. Falls back to a constant
 * so that, absent any header, every caller shares one (conservative) bucket.
 */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Build a stable bucket key for a request: prefer the authenticated user id
 * (stable across IPs), else fall back to the client IP. `scope` namespaces the
 * limit (e.g. "ai", "auth:signup") so different route families don't share one
 * budget.
 */
export function clientKey(scope: string, headers: Headers, userId?: string | null): string {
  return userId ? `${scope}:u:${userId}` : `${scope}:ip:${clientIp(headers)}`;
}
