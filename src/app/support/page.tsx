"use client";

import { useState } from "react";
import Link from "next/link";
import "../content.css";
import { COMPANY } from "@/lib/legal/company";

type Status = "idle" | "sending" | "sent" | "error";

export default function SupportPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Couldn’t send your message. Please try again, or contact us on Instagram.");
        setStatus("error");
        return;
      }
      // The confirmation only needs the reply address; don't retain the
      // submitted message in component state after a successful send.
      setName("");
      setMessage("");
      setError(null);
      setStatus("sent");
    } catch {
      setError("Network error. Please try again, or contact us on Instagram.");
      setStatus("error");
    }
  }

  return (
    <main className="content content-narrow">
      <Link href="/" className="content-back">← Back to Orire</Link>
      <h1>Support</h1>

      {status === "sent" ? (
        <p className="content-lede">
          Thanks — your message is on its way. We’ll reply to{" "}
          <strong>{email}</strong> as soon as we can.
        </p>
      ) : (
        <>
          <p className="content-lede">
            Question, bug, or feedback? Contact us on Instagram at{" "}
            <a href={COMPANY.contactUrl}>{COMPANY.contactLabel}</a> for support
            or an initial privacy enquiry. Do not send CVs, passwords, identity
            documents or payment details through Instagram. You can also use
            the form below to request an email reply.
          </p>

          <form className="support-form" onSubmit={submit}>
            <label className="support-field">
              <span>Your name (optional)</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                autoComplete="name"
              />
            </label>
            <label className="support-field">
              <span>Your email</span>
              <input
                type="email"
                aria-invalid={status === "error"}
                aria-describedby={status === "error" ? "support-form-error" : undefined}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <label className="support-field">
              <span>How can we help?</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                minLength={10}
                maxLength={5000}
                rows={6}
              />
            </label>

            {status === "error" && error && (
              <p id="support-form-error" className="support-error" role="alert">{error}</p>
            )}

            <button type="submit" className="content-cta" disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : "Send message"}
            </button>
          </form>
        </>
      )}

      <p style={{ marginTop: 36 }}>
        See our <Link href="/privacy">Privacy Policy</Link> and{" "}
        <Link href="/terms">Terms of Service</Link>.
      </p>
    </main>
  );
}
