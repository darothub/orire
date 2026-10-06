import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { consumePasswordResetToken } from "@/lib/auth/reset";

/**
 * Completes the forgot-password flow: exchange a valid reset token for a new
 * password. Tokens are single-use and expire after 1 hour.
 */
export async function POST(req: Request) {
  let token = "";
  let password = "";
  try {
    const body = (await req.json()) as { token?: string; password?: string };
    token = String(body?.token ?? "").trim();
    password = String(body?.password ?? "");
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: "Missing reset token." }, { status: 400 });
  }
  const weak = validatePassword(password);
  if (weak) {
    return NextResponse.json({ error: weak }, { status: 400 });
  }

  const userId = await consumePasswordResetToken(token);
  if (!userId) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });

  return NextResponse.json({ ok: true });
}
