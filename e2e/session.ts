import { encode } from "next-auth/jwt";
import type { BrowserContext } from "@playwright/test";

/**
 * Hermetic NextAuth session for the e2e suite.
 *
 * The auth overlay is now a mandatory gate driven by `useSession()` and the
 * server seeds `SessionProvider` from `auth()` on first paint, so the only way
 * to land in the workspace without a real login is to present a valid Auth.js
 * session cookie. We mint one here with a fixed secret (also injected into the
 * e2e web server via playwright.config.ts) so `auth()` authenticates on the
 * very first request — no database, OAuth provider or credentials involved.
 *
 * Auth.js uses the JWT session strategy (see src/lib/auth/auth.ts), so decoding
 * this cookie is stateless and never touches Prisma.
 */
export const E2E_AUTH_SECRET =
  process.env.E2E_AUTH_SECRET ?? "orire-e2e-secret-do-not-use-in-production";

/** Cookie name Auth.js uses over http (no `__Secure-` prefix without https). */
export const SESSION_COOKIE = "authjs.session-token";

/** Add a valid Auth.js session cookie to the browser context. */
export async function addSessionCookie(context: BrowserContext) {
  const token = await encode({
    token: {
      id: "e2e-user",
      sub: "e2e-user",
      name: "E2E Tester",
      email: "e2e@orire.test",
    },
    secret: E2E_AUTH_SECRET,
    salt: SESSION_COOKIE,
    maxAge: 60 * 60 * 24 * 365,
  });
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    },
  ]);
}
