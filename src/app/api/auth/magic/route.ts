import { NextResponse } from "next/server";
import { isValidEmail } from "@/lib/auth/password";
import { createMagicLinkToken } from "@/lib/auth/magic";
import { CAPTCHA_COOKIE, captchaEnabled, verifyCaptchaProof } from "@/lib/auth/turnstile";
import { sendMail } from "@/lib/email/mailer";
import { magicLinkEmail } from "@/lib/email/templates";
import { authRateLimit } from "@/lib/ratelimit/guard";

/**
 * Emails a one-time sign-in link. Works for new and existing addresses alike
 * and always answers the same way, so it can't be used to probe which emails
 * have accounts. Delivery failures are still surfaced so the user can retry.
 */
export async function POST(req: Request) {
  const limited = await authRateLimit(req, "magic");
  if (limited) return limited;

  let email = "";
  try {
    const body = (await req.json()) as { email?: string };
    email = String(body?.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  if (captchaEnabled()) {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    if (!verifyCaptchaProof(jar.get(CAPTCHA_COOKIE)?.value)) {
      return NextResponse.json(
        { error: "Please complete the security check and try again." },
        { status: 400 },
      );
    }
  }

  try {
    const token = await createMagicLinkToken(email);
    const { subject, html, text } = magicLinkEmail(token);
    await sendMail({ to: email, subject, html, text });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
