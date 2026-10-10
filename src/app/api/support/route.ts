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
 * so the operator can reply directly. Delivery errors surface verbatim.
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

  const email = String(body?.email ?? "").trim().toLowerCase();
  const name = String(body?.name ?? "").trim().slice(0, MAX_NAME);
  const message = String(body?.message ?? "").trim().slice(0, MAX_MESSAGE);

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
    await sendMail({ to: inbox, subject, html, text });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
