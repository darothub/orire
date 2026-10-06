import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isValidEmail } from "@/lib/auth/password";
import { createPasswordResetToken } from "@/lib/auth/reset";
import { sendMail } from "@/lib/email/mailer";
import { passwordResetEmail } from "@/lib/email/templates";

/**
 * Starts the forgot-password flow. Per product decision, this tells the user
 * directly when an email isn't registered (rather than always returning ok) so
 * they don't sit waiting for an email that will never arrive. Accounts that
 * exist but only use Google sign-in (no password) are told to use Google.
 */
export async function POST(req: Request) {
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

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return NextResponse.json(
      { error: "This email isn’t registered. Create an account to get started." },
      { status: 404 },
    );
  }

  if (!user.passwordHash) {
    return NextResponse.json(
      { error: "This account signs in with Google — use “Continue with Google” instead." },
      { status: 409 },
    );
  }

  try {
    const token = await createPasswordResetToken(user.id);
    const { subject, html, text } = passwordResetEmail(token);
    await sendMail({ to: email, subject, html, text });
  } catch (e) {
    // Surface real delivery failures verbatim (e.g. SMTP/Resend down).
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
