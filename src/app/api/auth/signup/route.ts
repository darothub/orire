import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { CAPTCHA_COOKIE, captchaEnabled } from "@/lib/auth/turnstile";
import { hashPassword, validateCredentials } from "@/lib/auth/password";
import { createEmailVerificationToken } from "@/lib/auth/verify";
import { sendMail } from "@/lib/email/mailer";
import { emailVerificationEmail } from "@/lib/email/templates";
import { authRateLimit } from "@/lib/ratelimit/guard";

/**
 * Creates an email + password account. The account is created UNVERIFIED and a
 * verification link is emailed; free runs stay locked until the user confirms
 * their email (this is what stops free-quota farming via throwaway accounts).
 * Errors are returned verbatim so the UI can show them. Captcha (when enabled)
 * must already be solved — the client posts the token to /api/auth/turnstile
 * first, which sets the cookie this route checks.
 */
export async function POST(req: Request) {
  const limited = authRateLimit(req, "signup");
  if (limited) return limited;

  let email = "";
  let password = "";
  let name: string | undefined;
  try {
    const body = (await req.json()) as { email?: string; password?: string; name?: string };
    email = String(body?.email ?? "").trim().toLowerCase();
    password = String(body?.password ?? "");
    name = body?.name?.trim() || undefined;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const invalid = validateCredentials(email, password);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  if (captchaEnabled()) {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    if (jar.get(CAPTCHA_COOKIE)?.value !== "1") {
      return NextResponse.json(
        { error: "Please complete the security check and try again." },
        { status: 400 },
      );
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Try signing in instead." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
  });

  // Email a single-use verification link. Delivery failures are surfaced
  // verbatim so the user knows to retry rather than silently losing the email.
  try {
    const token = await createEmailVerificationToken(user.id);
    const { subject, html, text } = emailVerificationEmail(token);
    await sendMail({ to: email, subject, html, text });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  return NextResponse.json({ ok: true, verify: true });
}
