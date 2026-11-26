import { appUrl } from "@/lib/email/mailer";

/**
 * Email colours, taken from the v4 tokens (src/styles/orire-tokens.css, dark). They are inline
 * because email clients ignore external CSS and most strip SVG, so the brand mark is the gold
 * burst character rather than the SVG.
 */
const CANVAS = "#14121C";
const SURFACE = "#1C1926";
const LINE = "#2B2639";
const INK = "#F4F2F8";
const INK_SOFT = "#C9C4DC";
const MUTED = "#938DA8";
const GOLD = "#F5C56B";
const VIOLET_SOFT = "#A99EF9";
const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** One layout for every Orire email: dark canvas, a raised card, a gold button, a plain-link fallback. */
function layout(o: { heading: string; body: string; cta: string; link: string; footnote: string; showLink?: boolean }): string {
  const link = esc(o.link);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="color-scheme" content="dark light" />
    <meta name="supported-color-schemes" content="dark light" />
    <title>${esc(o.heading)}</title>
  </head>
  <body style="margin:0;background:${CANVAS};padding:32px 12px;font-family:${FONT};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="max-width:460px;background:${SURFACE};border:1px solid ${LINE};border-radius:20px;">
          <tr><td style="padding:32px 32px 8px;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:${INK};">
            <span style="color:${GOLD};">&#10022;</span>&nbsp;Orire
          </td></tr>
          <tr><td style="padding:12px 32px 6px;font-size:20px;font-weight:700;letter-spacing:-0.01em;color:${INK};">
            ${o.heading}
          </td></tr>
          <tr><td style="padding:0 32px 24px;font-size:14px;line-height:1.65;color:${INK_SOFT};">
            ${o.body}
          </td></tr>
          <tr><td style="padding:0 32px 24px;">
            <a href="${link}" style="display:inline-block;background:${GOLD};color:${CANVAS};font-weight:700;font-size:14px;text-decoration:none;padding:13px 24px;border-radius:14px;">${o.cta}</a>
          </td></tr>
          <tr><td style="padding:0 32px 32px;font-size:12px;line-height:1.6;color:${MUTED};border-top:1px solid ${LINE};">
            <div style="padding-top:18px;">${o.footnote}${
              o.showLink === false
                ? ""
                : `<br/><br/>Or paste this link into your browser:<br/><a href="${link}" style="color:${VIOLET_SOFT};word-break:break-all;">${link}</a>`
            }</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

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
  const subject = "Reset your Orire password";
  const html = layout({
    heading: "Reset your password",
    body: "We received a request to reset your Orire password. Choose a new one with the button below. This link expires in 1 hour and can be used once.",
    cta: "Reset password",
    link,
    footnote: "If you didn't request this, you can safely ignore this email. Your password won't change.",
  });
  const text = [
    "Reset your Orire password",
    "",
    "We received a request to reset your Orire password.",
    "Open this link to choose a new one (expires in 1 hour, single use):",
    link,
    "",
    "If you didn't request this, you can safely ignore this email.",
  ].join("\n");
  return { subject, html, text };
}

/**
 * Passwordless sign-in email. `token` is the raw (unhashed) token; the /magic
 * page exchanges it for a session.
 */
export function magicLinkEmail(token: string): {
  subject: string;
  html: string;
  text: string;
} {
  const link = `${appUrl()}/magic?token=${encodeURIComponent(token)}`;
  const subject = "Your Orire sign-in link";
  const html = layout({
    heading: "Sign in to Orire",
    body: "Use the button below to sign in, no password needed. This link expires in 15 minutes and can be used once. If you ask for another link, only the newest one works.",
    cta: "Sign in",
    link,
    footnote: "If you didn't request this, you can safely ignore this email.",
  });
  const text = [
    "Sign in to Orire",
    "",
    "Open this link to sign in, no password needed (expires in 15 minutes, single use; only the newest link works):",
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
  const subject = "Verify your Orire email";
  const html = layout({
    heading: "Confirm your email",
    body: "Welcome to Orire. Confirm this email address to activate your account and start your free runs. This link expires in 24 hours and can be used once.",
    cta: "Verify email",
    link,
    footnote: "If you didn't create an Orire account, you can safely ignore this email.",
  });
  const text = [
    "Confirm your email",
    "",
    "Welcome to Orire. Confirm your email to activate your account and start",
    "your free runs (link expires in 24 hours, single use):",
    link,
    "",
    "If you didn't create an Orire account, you can safely ignore this email.",
  ].join("\n");
  return { subject, html, text };
}

/**
 * Activation nudge, sent once by the activation-nudge cron (P1-12) to a
 * signed-up user who, 24–48h later, still hasn't tried whichever of
 * {export, Simulate} `gap` names. Returns subject + html + text for
 * sendMail(). `gap === "both"` covers both CTAs in one email.
 */
export function activationNudgeEmail(gap: "export" | "simulate" | "both"): {
  subject: string;
  html: string;
  text: string;
} {
  const studioLink = `${appUrl()}/`;

  const copy = {
    export: {
      subject: "Your CV is ready to download",
      heading: "Don't forget to download your CV",
      body: "You started a CV on Orire but haven't downloaded it yet. Export it as a PDF or Word file whenever you're ready, it only takes a second.",
      cta: "Open your CV",
    },
    simulate: {
      subject: "See the 100%-match CV for your target job",
      heading: "Try Simulate, see exactly where your CV falls short",
      body: "Orire can show you what a 100%-match CV would look like for any job, then help you close the gap in your own words, nothing invented. Most people find this the most useful thing here.",
      cta: "Try Simulate",
    },
    both: {
      subject: "Pick up where you left off on Orire",
      heading: "Pick up where you left off",
      body: "You started a CV on Orire but haven't tried Simulate (see the 100%-match CV for a job and exactly where yours falls short) or downloaded your CV yet. Both take under a minute.",
      cta: "Open your CV",
    },
  }[gap];

  const subject = copy.subject;

  const html = layout({
    heading: copy.heading,
    body: copy.body,
    cta: copy.cta,
    link: studioLink,
    footnote: "You're getting this because you signed up for Orire. We'll only send this once.",
    showLink: false,
  });

  const text = [copy.heading, "", copy.body, "", studioLink, "", "You're getting this because you signed up for Orire. We'll only send this once."].join(
    "\n",
  );

  return { subject, html, text };
}
