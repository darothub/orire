import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isValidEmail } from "@/lib/auth/password";
import { createPasswordResetToken } from "@/lib/auth/reset";
import { sendMail } from "@/lib/email/mailer";
import { passwordResetEmail } from "@/lib/email/templates";

/**
 * Starts the forgot-password flow. To avoid leaking which emails have accounts,
 * this ALWAYS responds { ok: true } — even for unknown addresses or accounts
 * that only use Google (no password). A reset email is sent only when a real
 * password account matches.
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

  // Only send to accounts that can actually use a password.
  if (user?.passwordHash) {
    try {
      const token = await createPasswordResetToken(user.id);
      const { subject, html, text } = passwordResetEmail(token);
      await sendMail({ to: email, subject, html, text });
    } catch (e) {
      // Surface real delivery failures verbatim (e.g. SMTP/Resend down).
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true });
}
