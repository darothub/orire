/**
 * orire — signed run tokens for server-enforced refine gating (Phase B1).
 *
 * The AI refine proxy (`/api/ai/refine`) is the only path that spends money /
 * quota. To make the plan gate impossible to bypass from devtools, that route
 * refuses to call any provider without a valid run token. A token is minted
 * ONLY by the `authorizeRefineRun` server action, and only after it has checked
 * the caller's plan (from Postgres) and consumed one unit of monthly usage.
 *
 * Tokens are stateless HMAC-signed blobs (no DB round-trip in the hot route):
 *   base64url(payloadJSON) "." base64url(HMAC-SHA256(payload, secret))
 *
 * The payload attests which providers were authorized and when it expires, so
 * the route can verify a single provider call belongs to an authorized run.
 */

import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import type { ProviderId } from "@/lib/ai/types";
import type { PlanId } from "@/lib/plan/plan";

const TTL_MS = 5 * 60_000; // a run token is good for 5 minutes

export interface RunTokenPayload {
  /** Signed-in user id, or null for an anonymous free-tier trial run. */
  u: string | null;
  /** The plan this run was authorized against (route enforces model tiers). */
  plan: PlanId;
  /** Providers this run is allowed to invoke. */
  p: ProviderId[];
  /** Unique run id — the idempotency key for consuming exactly one refine per
   *  run (the first successful provider call claims it). */
  r: string;
  /** Expiry (epoch ms). */
  exp: number;
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set; cannot sign run tokens.");
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function signRunToken(input: { userId: string | null; plan: PlanId; providers: ProviderId[] }): string {
  const payload: RunTokenPayload = {
    u: input.userId,
    plan: input.plan,
    p: input.providers,
    r: randomUUID(),
    exp: Date.now() + TTL_MS,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const mac = b64url(createHmac("sha256", secret()).update(body).digest());
  return `${body}.${mac}`;
}

export interface RunTokenCheck {
  ok: boolean;
  payload?: RunTokenPayload;
  reason?: string;
}

/** Verify signature + expiry. Does NOT check provider membership (caller does). */
export function verifyRunToken(token: string | undefined | null): RunTokenCheck {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "Missing run authorization." };
  }
  const [body, mac] = token.split(".", 2);
  let expected: Buffer;
  try {
    expected = createHmac("sha256", secret()).update(body).digest();
  } catch {
    return { ok: false, reason: "Server not configured for run authorization." };
  }
  const got = fromB64url(mac);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
    return { ok: false, reason: "Invalid run authorization." };
  }
  let payload: RunTokenPayload;
  try {
    payload = JSON.parse(fromB64url(body).toString("utf8")) as RunTokenPayload;
  } catch {
    return { ok: false, reason: "Malformed run authorization." };
  }
  if (typeof payload.exp !== "number" || Date.now() > payload.exp) {
    return { ok: false, reason: "Run authorization expired. Try again." };
  }
  return { ok: true, payload };
}
