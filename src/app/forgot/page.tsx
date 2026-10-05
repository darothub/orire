"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="authpage">
      <div className="authpage-card">
        <div className="authpage-brand">
          <span aria-hidden>✦</span> orire
        </div>
        {done ? (
          <>
            <h1 className="authpage-title">Check your email</h1>
            <p className="authpage-sub">
              If an account exists for <strong>{email}</strong>, we’ve sent a
              link to reset your password. It expires in 1 hour.
            </p>
            <Link className="authpage-back" href="/?signin=1">
              ← Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="authpage-title">Reset your password</h1>
            <p className="authpage-sub">
              Enter the email for your account and we’ll send you a reset link.
            </p>
            <form className="authpage-form" onSubmit={submit}>
              <input
                type="email"
                className="auth-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <Link className="authpage-back" href="/?signin=1">
              ← Back to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
