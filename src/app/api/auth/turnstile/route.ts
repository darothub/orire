import { NextResponse } from "next/server";
import { CAPTCHA_COOKIE, CAPTCHA_TTL, captchaEnabled, signCaptchaProof, verifyTurnstile } from "@/lib/auth/turnstile";

/**
 * Verifies a Cloudflare Turnstile token. On success, sets a short-lived
 * HttpOnly cookie that the email sign-in provider requires before sending a
 * magic link. Returns provider errors verbatim so the UI can show them.
 */
export async function POST(req: Request) {
  if (!captchaEnabled()) return NextResponse.json({ ok: true, disabled: true });

  let token = "";
  try {
    const body = (await req.json()) as { token?: string };
    token = body?.token ?? "";
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  const result = await verifyTurnstile(token, ip);
  if (!result.success) {
    return NextResponse.json({ ok: false, error: result.error ?? "Captcha failed." }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(CAPTCHA_COOKIE, signCaptchaProof(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CAPTCHA_TTL,
  });
  return res;
}
