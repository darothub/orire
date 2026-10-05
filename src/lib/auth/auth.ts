import NextAuth, { type NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Nodemailer from "next-auth/providers/nodemailer";
import { cookies } from "next/headers";
import { CAPTCHA_COOKIE, captchaEnabled } from "@/lib/auth/turnstile";
// GitHub OAuth is disabled for now. Re-enable by restoring this import, the
// provider block below, and the GitHub button in AuthOverlay.
// import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import { prisma } from "@/lib/db/prisma";

/**
 * Auth providers are enabled by environment so local dev needs zero secrets:
 *  - Magic-link email is always on. With no SMTP configured the sign-in URL is
 *    printed to the server terminal (dev). Set EMAIL_SERVER + EMAIL_FROM for real send.
 *  - GitHub is disabled for now (hidden in the UI). Google turns on
 *    automatically when its client id/secret are present.
 */
function buildProviders(): Provider[] {
  const providers: Provider[] = [
    Nodemailer({
      server: process.env.EMAIL_SERVER ?? { host: "localhost", port: 1025 },
      from: process.env.EMAIL_FROM ?? "orire <no-reply@orire.local>",
      async sendVerificationRequest({ identifier, url, provider }) {
        // Captcha gate: when Turnstile is enabled, the client must have passed
        // /api/auth/turnstile first (which sets an HttpOnly cookie). No cookie,
        // no email — this blocks headless magic-link bombing.
        if (captchaEnabled()) {
          const jar = await cookies();
          if (jar.get(CAPTCHA_COOKIE)?.value !== "1") {
            throw new Error("Captcha verification required before sending a sign-in link.");
          }
        }
        if (process.env.EMAIL_SERVER) {
          // Real SMTP configured — send via nodemailer default transport.
          const nodemailer = await import("nodemailer");
          const transport = nodemailer.createTransport(provider.server);
          await transport.sendMail({
            to: identifier,
            from: provider.from,
            subject: "Your orire sign-in link",
            text: `Sign in to orire:\n${url}\n`,
            html: `<p>Sign in to <strong>orire</strong>:</p><p><a href="${url}">${url}</a></p>`,
          });
          return;
        }
        // Dev fallback: surface the link in the terminal.
        console.log(
          `\n\u001b[35m\u2727 orire sign-in link for ${identifier}:\u001b[0m\n${url}\n`,
        );
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
  session: { strategy: "database" },
  providers: buildProviders(),
  pages: { verifyRequest: "/?checkEmail=1" },
  callbacks: {
    // Expose the DB user id on the session (needed by server actions that scope
    // data per user). Not included by default in the session payload.
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
