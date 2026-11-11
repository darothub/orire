/**
 * orire — signed coach-run tokens.
 *
 * The coach's analyze call consumes one monthly unit and mints a token. The
 * follow-up rewrite/critique calls must present it, so they can't be reached
 * without paying for a run. Stateless HMAC like the refine run token; the
 * per-run step budget is enforced separately (see the agents route).
 */

import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";

const TTL_MS = 30 * 60_000;

/** Max model-calling steps (rewrite + critique) one paid coach run may use. */
export const COACH_STEPS_PER_RUN = 6;

export interface CoachTokenPayload {
  u: string;
  r: string;
  exp: number;
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set; cannot sign coach tokens.");
  return s;
}

const b64url = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
const mac = (body: string) => createHmac("sha256", secret()).update(`coach:${body}`).digest();

/**
 * The run id leads with the zero-padded expiry so step-counter rows can be
 * purged with a plain string comparison once their token can no longer be used.
 */
const runKey = (p: CoachTokenPayload) => `${String(p.exp).padStart(15, "0")}-${p.r}`;

/** Period-key cutoff: step counters sorting below this belong to expired runs. */
export const coachStepCutoff = (now = Date.now()) => String(now).padStart(15, "0");

export function signCoachToken(userId: string, now = Date.now()): { token: string; runId: string } {
  const payload: CoachTokenPayload = { u: userId, r: randomUUID(), exp: now + TTL_MS };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return { token: `${body}.${b64url(mac(body))}`, runId: runKey(payload) };
}

export function verifyCoachToken(
  token: unknown,
  userId: string,
  now = Date.now(),
): { ok: true; runId: string } | { ok: false; reason: string } {
  if (typeof token !== "string" || !token.includes(".")) return { ok: false, reason: "Start the coach from the beginning." };
  const [body, sig] = token.split(".", 2);
  const got = fromB64url(sig);
  const expected = mac(body);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
    return { ok: false, reason: "Invalid coach session. Start over." };
  }
  let payload: CoachTokenPayload;
  try {
    payload = JSON.parse(fromB64url(body).toString("utf8")) as CoachTokenPayload;
  } catch {
    return { ok: false, reason: "Invalid coach session. Start over." };
  }
  if (payload.u !== userId) return { ok: false, reason: "Invalid coach session. Start over." };
  if (typeof payload.exp !== "number" || now > payload.exp) return { ok: false, reason: "This coach session expired. Start over." };
  return { ok: true, runId: runKey(payload) };
}
