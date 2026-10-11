/**
 * One tiny send abstraction for the whole app.
 *
 * Transport is chosen by environment, so no code changes between dev and prod:
 *   • RESEND_API_KEY set   → send via Resend's HTTP API (production).
 *   • otherwise            → send over SMTP to a local sink (Mailpit) so dev
 *                            needs no account, no secrets and works offline.
 *
 * Mailpit defaults: SMTP on localhost:1025, web UI on http://localhost:8025.
 * Run it with `npm run mail:dev` (see package.json) or `docker compose -f
 * docker-compose.dev.yml up mailpit`.
 */

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Optional Reply-To (e.g. a support submitter), so a reply reaches them. */
  replyTo?: string;
}

/** The verified from-address. In prod this must be on your Resend domain. */
export const EMAIL_FROM = process.env.EMAIL_FROM || "Orire <noreply@orire.app>";

/** Absolute base URL used to build links inside emails. */
export function appUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

/**
 * Send one transactional email. Throws on failure with a readable message so
 * callers can surface it (we never swallow provider errors silently).
 */
export async function sendMail(msg: MailMessage): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;

  if (resendKey) {
    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
    });
    if (error) {
      throw new Error(`Email send failed (Resend): ${error.message}`);
    }
    return;
  }

  // Dev/local: SMTP to Mailpit (or any SMTP sink). No auth by default.
  const nodemailer = (await import("nodemailer")).default;
  const host = process.env.MAIL_SMTP_HOST || "localhost";
  const port = Number(process.env.MAIL_SMTP_PORT || 1025);
  const user = process.env.MAIL_SMTP_USER;
  const pass = process.env.MAIL_SMTP_PASS;

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: user && pass ? { user, pass } : undefined,
  });

  try {
    await transport.sendMail({
      from: EMAIL_FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
    });
  } catch (e) {
    throw new Error(
      `Email send failed (SMTP ${host}:${port}). Is Mailpit running? ` +
        `Start it with \`npm run mail:dev\`. Cause: ${(e as Error).message}`,
    );
  }
}
