/**
 * On-demand captcha for sign-in. Failed password sign-ins are counted per
 * client IP and per email (whether or not the account exists, so counts reveal
 * nothing about which emails are registered). Once either counter reaches the
 * threshold within the window, sign-in requires a solved Turnstile proof.
 * Sign-up and magic-link sends always require one (they send email).
 */

import { checkLimitShared, peekCountShared } from "@/lib/ratelimit/shared";
import { clientIp } from "@/lib/ratelimit/rateLimit";

export const CAPTCHA_AFTER_FAILURES = 2;
const WINDOW_MS = 15 * 60_000;
// High ceiling: we only use the counter, never the ok/remaining verdict.
const CEILING = 1_000_000;

function keys(headers: Headers, email?: string | null): string[] {
  const k = [`auth:fail:ip:${clientIp(headers)}`];
  const e = email?.trim().toLowerCase();
  if (e) k.push(`auth:fail:email:${e}`);
  return k;
}

export async function recordSignInFailure(headers: Headers, email?: string | null): Promise<void> {
  await Promise.all(keys(headers, email).map((k) => checkLimitShared(k, CEILING, WINDOW_MS)));
}

export async function signInCaptchaRequired(headers: Headers, email?: string | null): Promise<boolean> {
  const counts = await Promise.all(keys(headers, email).map((k) => peekCountShared(k)));
  return counts.some((n) => n >= CAPTCHA_AFTER_FAILURES);
}
