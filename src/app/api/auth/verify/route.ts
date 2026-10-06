import { NextResponse } from "next/server";
import { consumeEmailVerificationToken } from "@/lib/auth/verify";
import { appUrl } from "@/lib/email/mailer";

/**
 * Consumes an email-verification token from the link sent at signup. On success
 * the user's email is marked verified and they're redirected into the app with
 * `?verified=1`; on failure with `?verify_error=...` so the UI can explain.
 * GET (not POST) because this is opened directly from an email client.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const base = appUrl();

  const userId = token ? await consumeEmailVerificationToken(token) : null;
  if (!userId) {
    const dest = new URL("/", base);
    dest.searchParams.set("verify_error", "This verification link is invalid or has expired.");
    return NextResponse.redirect(dest);
  }

  const dest = new URL("/", base);
  dest.searchParams.set("verified", "1");
  return NextResponse.redirect(dest);
}
