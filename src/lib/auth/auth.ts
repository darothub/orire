import NextAuth, { type NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { CAPTCHA_COOKIE, captchaEnabled, verifyCaptchaProof } from "@/lib/auth/turnstile";
import { verifyPassword } from "@/lib/auth/password";
// GitHub OAuth is disabled for now. Re-enable by restoring this import, the
// provider block below, and the GitHub button in AuthOverlay.
// import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import { prisma } from "@/lib/db/prisma";

/**
 * Auth providers are enabled by environment so local dev needs zero secrets:
 *  - Email + password is always on. Accounts are created via /api/auth/signup
 *    (password hashed with bcrypt) and verified here on sign-in.
 *  - GitHub is disabled for now (hidden in the UI). Google turns on
 *    automatically when its client id/secret are present.
 *
 * Note: the Credentials provider requires the JWT session strategy, so this
 * config uses `strategy: "jwt"` (not database sessions). The Prisma adapter is
 * still used to persist users/accounts and to link Google OAuth sign-ins.
 */
const NEW_USER_WINDOW_MS = 2 * 60 * 1000;

function buildProviders(): Provider[] {
  const providers: Provider[] = [
    Credentials({
      id: "credentials",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        // Captcha gate: when Turnstile is enabled, the client must have passed
        // /api/auth/turnstile first (which sets an HttpOnly cookie). No cookie,
        // no sign-in — this blocks headless credential-stuffing.
        if (captchaEnabled()) {
          const jar = await cookies();
          if (!verifyCaptchaProof(jar.get(CAPTCHA_COOKIE)?.value)) {
            throw new Error("Captcha verification required before signing in.");
          }
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ];

  // GitHub OAuth disabled for now:
  // if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  //   providers.push(GitHub);
  // }
  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(Google);
  }
  return providers;
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: buildProviders(),
  callbacks: {
    // Captcha gate for OAuth (e.g. Google): when Turnstile is enabled, the
    // client must have passed /api/auth/turnstile first (which sets an HttpOnly
    // cookie). Credentials sign-in is already gated inside authorize().
    async signIn({ account }) {
      if (account && account.provider !== "credentials" && captchaEnabled()) {
        const jar = await cookies();
        if (!verifyCaptchaProof(jar.get(CAPTCHA_COOKIE)?.value)) return false;
      }
      return true;
    },
    // Carry the DB user id on the JWT so server actions can scope data per user.
    // On the sign-in that created the account (row < 2 min old) flag it so the
    // client can report one sign-up conversion for email and OAuth alike.
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        const row = await prisma.user.findUnique({
          where: { id: user.id },
          select: { createdAt: true },
        });
        token.isNewUser = row ? Date.now() - row.createdAt.getTime() < NEW_USER_WINDOW_MS : false;
      }
      return token;
    },
    // Expose the user id on the session (read by server actions via auth()).
    session({ session, token }) {
      if (session.user && token.id) session.user.id = String(token.id);
      if (token.isNewUser) session.isNewUser = true;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
