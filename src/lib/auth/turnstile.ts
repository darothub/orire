/**
 * Cloudflare Turnstile — server-side verification for the magic-link form.
 *
 * Captcha is OPT-IN: it only activates when TURNSTILE_SECRET_KEY is set, so
 * local dev needs no secrets. When active, the client solves the widget and
 * posts the token to /api/auth/turnstile, which verifies it here and sets a
 * short-lived HttpOnly cookie. The email provider (auth.ts) refuses to send a
 * sign-in link unless that cookie is present — blocking headless email-bombing.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** HttpOnly cookie set by the verify route once a token checks out. */
export const CAPTCHA_COOKIE = "orire_captcha";
/** How long a solved captcha stays valid (seconds). */
export const CAPTCHA_TTL = 300;

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Whether captcha enforcement is switched on for this server. */
export function captchaEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export interface TurnstileResult {
  success: boolean;
  /** Human-readable error (verbatim-friendly) when verification fails. */
  error?: string;
}

/** Verify a Turnstile token against Cloudflare. */
export async function verifyTurnstile(token: string, remoteIp?: string): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { success: true }; // disabled — treat as a pass.
  if (!token) return { success: false, error: "Captcha token missing. Please complete the challenge." };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  let data: { success?: boolean; "error-codes"?: string[] };
  try {
    const res = await fetch(SITEVERIFY, { method: "POST", body });
    data = await res.json();
  } catch (e) {
    return { success: false, error: `Could not reach the captcha service: ${(e as Error).message}` };
  }

  if (data.success) return { success: true };
  const codes = (data["error-codes"] ?? []).join(", ") || "unknown error";
  return { success: false, error: `Captcha verification failed (${codes}).` };
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/**
 * Mint a signed, expiring proof that a Turnstile challenge was solved.
 *
 * Replaces the old unsigned "1" cookie: HttpOnly stops browser JS from READING
 * a cookie, but it does not prove the server ISSUED it — a forged request could
 * simply send the cookie and bypass the gate. This proof is HMAC-signed with
 * AUTH_SECRET and carries its own expiry, so only a value this server minted,
 * within CAPTCHA_TTL, is accepted.
 */
export function signCaptchaProof(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set; cannot sign a captcha proof.");
  const exp = Date.now() + CAPTCHA_TTL * 1000;
  const body = b64url(Buffer.from(String(exp), "utf8"));
  const mac = b64url(createHmac("sha256", s).update(`captcha.${body}`).digest());
  return `${body}.${mac}`;
}

/** Verify a captcha-proof cookie: authentic signature + not expired. Fails closed. */
export function verifyCaptchaProof(value: string | undefined | null): boolean {
  const s = process.env.AUTH_SECRET;
  if (!s || !value || typeof value !== "string" || !value.includes(".")) return false;
  const [body, mac] = value.split(".", 2);
  let expected: Buffer;
  try {
    expected = createHmac("sha256", s).update(`captcha.${body}`).digest();
  } catch {
    return false;
  }
  const got = fromB64url(mac);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return false;
  let exp: number;
  try {
    exp = Number(fromB64url(body).toString("utf8"));
  } catch {
    return false;
  }
  return Number.isFinite(exp) && Date.now() <= exp;
}
