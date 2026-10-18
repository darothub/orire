/**
 * orire — route-level rate-limit guards.
 *
 * Thin glue over the pure limiter in `rateLimit.ts` that turns an exceeded
 * limit into a ready-to-return `NextResponse`, shaped to match each route
 * family so the existing UI can surface it. Call these at the very top of a
 * route handler and early-return when they yield a response.
 */

import { NextResponse } from "next/server";
import { clientKey, type RateLimitResult } from "@/lib/ratelimit/rateLimit";
import { checkLimitShared } from "@/lib/ratelimit/shared";
import { logger } from "@/lib/obs/logger";
import type { ProviderId } from "@/lib/ai/types";

export interface LimitConfig {
  scope: string;
  limit: number;
  windowMs: number;
}

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** AI routes share one budget per caller: they all spend the managed key. */
export function aiLimitConfig(): LimitConfig {
  return {
    scope: "ai",
    limit: envInt("RATE_LIMIT_AI_MAX", 30),
    windowMs: envInt("RATE_LIMIT_AI_WINDOW_MS", 60_000),
  };
}

/** Auth email routes (signup / forgot): tight per-IP budget to curb abuse. */
export function authLimitConfig(scope: string): LimitConfig {
  return {
    scope: `auth:${scope}`,
    limit: envInt("RATE_LIMIT_AUTH_MAX", 6),
    windowMs: envInt("RATE_LIMIT_AUTH_WINDOW_MS", 60_000),
  };
}

function headers(r: RateLimitResult): Record<string, string> {
  return {
    "retry-after": String(Math.ceil(r.resetMs / 1000)),
    "x-ratelimit-limit": String(r.limit),
    "x-ratelimit-remaining": String(r.remaining),
  };
}

async function apply(req: Request, cfg: LimitConfig, userId?: string | null): Promise<RateLimitResult> {
  const result = await checkLimitShared(clientKey(cfg.scope, req.headers, userId), cfg.limit, cfg.windowMs);
  if (!result.ok) logger.warn("ratelimit.block", { scope: cfg.scope, limit: cfg.limit });
  return result;
}

/**
 * Guard an AI route. Returns a 429 `NextResponse` (shaped like the route's
 * `fail()` body so the client surfaces it verbatim) when the caller is over the
 * limit, or `null` when the request may proceed.
 *
 * Pass `userId` whenever the caller is known (verified session or refine run
 * token). Buckets are then per-account via the shared store; without it they
 * fall back to client IP.
 */
export async function aiRateLimit(req: Request, provider: ProviderId, userId?: string | null): Promise<NextResponse | null> {
  const result = await apply(req, aiLimitConfig(), userId);
  if (result.ok) return null;
  const secs = Math.ceil(result.resetMs / 1000);
  const message = `You’re sending requests too quickly. Please wait ${secs}s and try again.`;
  return NextResponse.json(
    { ok: false, provider, model: "", error: { provider, message, status: 429 } },
    { status: 429, headers: headers(result) },
  );
}

/**
 * Guard an auth email route. Returns a 429 `NextResponse` with an `{ error }`
 * body (matching signup/forgot) when over the limit, else `null`.
 */
export async function authRateLimit(req: Request, scope: string): Promise<NextResponse | null> {
  const result = await apply(req, authLimitConfig(scope), null);
  if (result.ok) return null;
  const secs = Math.ceil(result.resetMs / 1000);
  return NextResponse.json(
    { error: `Too many attempts. Please wait ${secs}s and try again.` },
    { status: 429, headers: headers(result) },
  );
}
