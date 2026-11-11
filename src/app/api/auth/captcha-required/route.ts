import { NextResponse } from "next/server";
import { captchaEnabled } from "@/lib/auth/turnstile";
import { signInCaptchaRequired } from "@/lib/auth/captchaGate";

/** Tells the sign-in form whether it must show the security check now. */
export async function POST(req: Request) {
  if (!captchaEnabled()) return NextResponse.json({ required: false });
  let email: string | undefined;
  try {
    const body = (await req.json()) as { email?: string };
    email = typeof body?.email === "string" ? body.email : undefined;
  } catch {
    // Treat a missing body as "IP only".
  }
  return NextResponse.json({ required: await signInCaptchaRequired(req.headers, email) });
}
