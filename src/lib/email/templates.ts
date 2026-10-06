import { appUrl } from "@/lib/email/mailer";

/** Shared brand colours (kept inline — email clients ignore external CSS). */
const ACCENT = "#8b7cff";
const BG = "#0b0d12";

/**
 * Password-reset email. Returns subject + html + text for sendMail().
 * `token` is the raw (unhashed) token; we build the reset link here.
 */
export function passwordResetEmail(token: string): {
  subject: string;
  html: string;
  text: string;
} {
  const link = `${appUrl()}/reset?token=${encodeURIComponent(token)}`;
  const subject = "Reset your orire password";

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:${BG};padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="440" cellpadding="0" cellspacing="0"
          style="background:#13161f;border:1px solid #242a38;border-radius:16px;padding:32px;">
          <tr><td style="font-size:20px;font-weight:700;color:#fff;padding-bottom:4px;">
            <span style="color:${ACCENT};">✦</span> orire
          </td></tr>
          <tr><td style="font-size:18px;font-weight:600;color:#fff;padding:14px 0 6px;">
            Reset your password
          </td></tr>
          <tr><td style="font-size:14px;line-height:1.6;color:#a6adbb;padding-bottom:22px;">
            We received a request to reset your orire password. Click the button
            below to choose a new one. This link expires in 1 hour and can be
            used once.
          </td></tr>
          <tr><td style="padding-bottom:22px;">
            <a href="${link}" style="display:inline-block;background:${ACCENT};color:#0b0d12;
              font-weight:600;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:10px;">
              Reset password
            </a>
          </td></tr>
          <tr><td style="font-size:12px;line-height:1.6;color:#6b7280;">
            If you didn't request this, you can safely ignore this email — your
            password won't change. Or paste this link into your browser:<br/>
            <a href="${link}" style="color:${ACCENT};word-break:break-all;">${link}</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    "Reset your orire password",
    "",
    "We received a request to reset your orire password.",
    "Open this link to choose a new one (expires in 1 hour, single use):",
    link,
    "",
    "If you didn't request this, you can safely ignore this email.",
  ].join("\n");

  return { subject, html, text };
}

/**
 * Email-verification email. Returns subject + html + text for sendMail().
 * `token` is the raw (unhashed) token; the verify API route consumes it.
 */
export function emailVerificationEmail(token: string): {
  subject: string;
  html: string;
  text: string;
} {
  const link = `${appUrl()}/api/auth/verify?token=${encodeURIComponent(token)}`;
  const subject = "Verify your orire email";

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:${BG};padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="440" cellpadding="0" cellspacing="0"
          style="background:#13161f;border:1px solid #242a38;border-radius:16px;padding:32px;">
          <tr><td style="font-size:20px;font-weight:700;color:#fff;padding-bottom:4px;">
            <span style="color:${ACCENT};">✦</span> orire
          </td></tr>
          <tr><td style="font-size:18px;font-weight:600;color:#fff;padding:14px 0 6px;">
            Confirm your email
          </td></tr>
          <tr><td style="font-size:14px;line-height:1.6;color:#a6adbb;padding-bottom:22px;">
            Welcome to orire. Confirm this email address to activate your account
            and start your free runs. This link expires in 24 hours and can be
            used once.
          </td></tr>
          <tr><td style="padding-bottom:22px;">
            <a href="${link}" style="display:inline-block;background:${ACCENT};color:#0b0d12;
              font-weight:600;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:10px;">
              Verify email
            </a>
          </td></tr>
          <tr><td style="font-size:12px;line-height:1.6;color:#6b7280;">
            If you didn't create an orire account, you can safely ignore this
            email. Or paste this link into your browser:<br/>
            <a href="${link}" style="color:${ACCENT};word-break:break-all;">${link}</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    "Confirm your email",
    "",
    "Welcome to orire. Confirm your email to activate your account and start",
    "your free runs (link expires in 24 hours, single use):",
    link,
    "",
    "If you didn't create an orire account, you can safely ignore this email.",
  ].join("\n");

  return { subject, html, text };
}
