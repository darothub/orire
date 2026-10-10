import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { createEmailVerificationToken } from "@/lib/auth/verify";
import { sendMail } from "@/lib/email/mailer";
import { emailVerificationEmail } from "@/lib/email/templates";
import { authRateLimit } from "@/lib/ratelimit/guard";

/**
 * Re-sends the email-verification link for the signed-in user. No-ops (still
 * returns ok) when already verified or when the account has no email, so the
 * response never leaks account state. Delivery failures are surfaced verbatim.
 */
export async function POST(req: Request) {
  const limited = await authRateLimit(req, "resend");
  if (limited) return limited;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in to resend the verification email." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });

  if (!user?.email || user.emailVerified) {
    return NextResponse.json({ ok: true });
  }

  try {
    const token = await createEmailVerificationToken(userId);
    const { subject, html, text } = emailVerificationEmail(token);
    await sendMail({ to: user.email, subject, html, text });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
