/**
 * Cloudflare Turnstile — server-side verification for the magic-link form.
 *
 * Captcha is OPT-IN: it only activates when TURNSTILE_SECRET_KEY is set, so
 * local dev needs no secrets. When active, the client solves the widget and
 * posts the token to /api/auth/turnstile, which verifies it here and sets a
 * short-lived HttpOnly cookie. The email provider (auth.ts) refuses to send a
 * sign-in link unless that cookie is present — blocking headless email-bombing.
 */

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
