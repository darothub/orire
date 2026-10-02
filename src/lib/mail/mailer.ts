/**
 * orire — minimal transactional mailer.
 *
 * Mirrors the magic-link email strategy in `@/lib/auth/auth`: when `EMAIL_SERVER`
 * is configured we send through nodemailer's default transport, otherwise we fall
 * back to logging the message to the server terminal so local dev needs no SMTP.
 * Kept transport-agnostic so callers (e.g. the team usage digest) never touch
 * nodemailer directly.
 */

export interface MailMessage {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

export interface MailResult {
  ok: boolean;
  /** True when a real SMTP transport delivered the message. */
  delivered: boolean;
  error?: string;
}

/** The "From" header used for all outbound orire mail. */
export function mailFrom(): string {
  return process.env.EMAIL_FROM ?? "orire <no-reply@orire.local>";
}

/** Whether a real SMTP transport is configured. */
export function mailConfigured(): boolean {
  return Boolean(process.env.EMAIL_SERVER);
}

/**
 * Send one message. With SMTP configured this delivers via nodemailer; without
 * it, the message is logged (dev fallback) and reported as `delivered: false`.
 */
export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const recipients = Array.isArray(msg.to) ? msg.to.filter(Boolean) : [msg.to];
  if (recipients.length === 0) return { ok: false, delivered: false, error: "No recipients." };

  if (!mailConfigured()) {
    console.log(
      `\n\u001b[36m\u2709 orire mail (dev, not sent)\u001b[0m\n` +
        `  to: ${recipients.join(", ")}\n  subject: ${msg.subject}\n` +
        msg.text.replace(/^/gm, "  ") +
        "\n",
    );
    return { ok: true, delivered: false };
  }

  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport(process.env.EMAIL_SERVER);
    await transport.sendMail({
      to: recipients,
      from: mailFrom(),
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    return { ok: true, delivered: true };
  } catch (err) {
    return {
      ok: false,
      delivered: false,
      error: err instanceof Error ? err.message : "Mail send failed.",
    };
  }
}
