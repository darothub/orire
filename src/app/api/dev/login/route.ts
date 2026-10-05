/**
 * orire — dev-only one-click full-access login (local development aid).
 *
 * GET /api/dev/login
 *   Upserts a fixed dev user on the top ("career") plan, mints a database
 *   session, sets the Auth.js session cookie, and redirects to `/`. You land
 *   signed in with every plan gate unlocked.
 *
 * Optional query params:
 *   ?plan=free|pro|career   grant a specific plan (default: career)
 *   ?email=you@example.com        sign in as a specific email (default: dev@orire.local)
 *   ?next=/some/path              post-login redirect target (same-origin only)
 *
 * Hard-gated by `devLoginEnabled()` → returns 404 in production.
 */

import { NextResponse, type NextRequest } from "next/server";
import { PLAN_ORDER, type PlanId } from "@/lib/plan/plan";
import {
  DEV_EMAIL,
  DEV_PLAN,
  DEV_SESSION_COOKIE,
  devLoginEnabled,
  provisionDevSession,
} from "@/lib/dev/devAccess";

export const runtime = "nodejs";

function parsePlan(raw: string | null): PlanId {
  return raw && (PLAN_ORDER as string[]).includes(raw) ? (raw as PlanId) : DEV_PLAN;
}

function safeNext(raw: string | null): string {
  // Only allow same-origin absolute paths to avoid an open-redirect.
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

export async function GET(req: NextRequest) {
  if (!devLoginEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const params = req.nextUrl.searchParams;
  const email = (params.get("email")?.trim() || DEV_EMAIL).toLowerCase();
  const plan = parsePlan(params.get("plan"));
  const next = safeNext(params.get("next"));

  const session = await provisionDevSession(email, plan);

  const res = NextResponse.redirect(new URL(next, req.url));
  res.cookies.set(DEV_SESSION_COOKIE, session.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: session.expires,
  });
  return res;
}
