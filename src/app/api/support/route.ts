import { NextResponse } from "next/server";
import { isValidEmail } from "@/lib/auth/password";
import { sendMail } from "@/lib/email/mailer";
import { authRateLimit } from "@/lib/ratelimit/guard";
import { COMPANY } from "@/lib/legal/company";

export const runtime = "nodejs";

const MAX_MESSAGE = 5000;
const MAX_NAME = 120;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Support contact endpoint. Emails the operator's support inbox via the shared
 * mailer (Resend in prod, SMTP/Mailpit in dev). Rate-limited per IP under the
 * shared "auth:support" budget. The sender's address goes in the subject/body
 * so the operator can reply directly. Mail transport details are never sent to clients.
 */
export async function POST(req: Request) {
  const limited = await authRateLimit(req, "support");
  if (limited) return limited;

  let body: { name?: unknown; email?: unknown; message?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  // Reject oversized submissions rather than silently removing part of a
  // support request (which can drop the details needed to help a customer).
  if (typeof body?.name !== "undefined" && typeof body.name !== "string") {
    return NextResponse.json({ error: "Please enter a valid name." }, { status: 400 });
  }
  if (typeof body?.message !== "string") {
    return NextResponse.json({ error: "Please enter a message." }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  const message = body.message.trim();
  if (name.length > MAX_NAME || message.length > MAX_MESSAGE) {
    return NextResponse.json({ error: "Your message is too long. Please shorten it and try again." }, { status: 400 });
  }
  if (typeof body?.email !== "string") {
    return NextResponse.json({ error: "Please enter a valid email so we can reply." }, { status: 400 });
  }
  const email = body.email.trim().toLowerCase();

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email so we can reply." }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json({ error: "Please add a little more detail (at least 10 characters)." }, { status: 400 });
  }

  const inbox = process.env.SUPPORT_INBOX || COMPANY.supportEmail;
  const who = name ? `${name} <${email}>` : email;
  const subject = `Orire support — ${name || email}`;
  const text = `From: ${who}\n\n${message}`;
  const html = `<p><strong>From:</strong> ${escapeHtml(who)}</p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`;

  try {
    await sendMail({ to: inbox, subject, html, text, replyTo: email });
  } catch {
    return NextResponse.json(
      { error: "Your message could not be sent right now. Please try again later or email support directly." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
