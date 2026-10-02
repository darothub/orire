/**
 * orire — dev-only full-access provisioning (local development aid).
 *
 * Mints a database session for a fixed dev user on the top ("teams") plan so a
 * developer can click into the app with every plan gate and team feature
 * unlocked — no magic-link email, no Stripe, no personal API key required for
 * premium *gating*. (Actually *calling* a provider still needs a real key; that
 * can't be faked.)
 *
 * SAFETY: every entry point is hard-gated by `devLoginEnabled()`, which is false
 * in production. Never import this from a code path that ships to prod users.
 *
 * Server-only (imports prisma + node crypto).
 */

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { setPlanId } from "@/lib/entitlement/entitlement";
import type { PlanId } from "@/lib/plan/plan";

/** The canonical Auth.js session cookie name for local (http) dev. */
export const DEV_SESSION_COOKIE = "authjs.session-token";

/** Fixed identity the dev login signs you in as. */
export const DEV_EMAIL = process.env.ORIRE_DEV_EMAIL ?? "dev@orire.local";
const DEV_NAME = "Dev User";

/** Default plan granted by the dev login — top tier, full access. */
export const DEV_PLAN: PlanId = "teams";

/** Session lifetime for a minted dev session. */
const SESSION_DAYS = 30;

/**
 * Whether the dev login is available. Enabled in any non-production build, and
 * can be force-disabled by setting `ORIRE_DEV_LOGIN=0`. Always false when
 * `NODE_ENV === "production"` regardless of the flag.
 */
export function devLoginEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.ORIRE_DEV_LOGIN !== "0";
}

export interface DevSession {
  sessionToken: string;
  expires: Date;
  userId: string;
  email: string;
  plan: PlanId;
}

/**
 * Upsert the dev user, grant it `plan`, and create a fresh database session.
 * Returns the token to set as the session cookie. Caller MUST have checked
 * `devLoginEnabled()` first.
 */
export async function provisionDevSession(
  email: string = DEV_EMAIL,
  plan: PlanId = DEV_PLAN,
): Promise<DevSession> {
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: DEV_NAME, emailVerified: new Date() },
    update: { emailVerified: new Date() },
  });

  await setPlanId(user.id, plan);

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { sessionToken, userId: user.id, expires } });

  return { sessionToken, expires, userId: user.id, email, plan };
}
