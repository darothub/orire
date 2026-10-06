import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * Reports the signed-in user's email-verification status from the DB (the
 * source of truth), so the client banner reflects reality even after the user
 * clicks the email link in another tab. Returns { verified:false } when signed
 * out so the banner simply stays hidden.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ signedIn: false, verified: false });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true, email: true },
  });
  return NextResponse.json({
    signedIn: true,
    verified: Boolean(user?.emailVerified),
    email: user?.email ?? null,
  });
}
