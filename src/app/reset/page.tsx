"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don’t match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
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

  if (!token) {
    return (
      <>
        <h1 className="authpage-title">Invalid link</h1>
        <p className="authpage-sub">
          This reset link is missing its token. Request a new one.
        </p>
        <Link className="authpage-back" href="/forgot">
          ← Request a new link
        </Link>
      </>
    );
  }

  if (done) {
    return (
      <>
        <h1 className="authpage-title">Password updated</h1>
        <p className="authpage-sub">
          Your password has been changed. You can now sign in with it.
        </p>
        <Link className="authpage-back" href="/">
          ← Back to sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="authpage-title">Choose a new password</h1>
      <p className="authpage-sub">Enter a new password for your account.</p>
      <form className="authpage-form" onSubmit={submit}>
        <input
          type="password"
          className="auth-input"
          placeholder="New password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <input
          type="password"
          className="auth-input"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <Link className="authpage-back" href="/">
        ← Back to sign in
      </Link>
    </>
  );
}

export default function ResetPage() {
  return (
    <main className="authpage">
      <div className="authpage-card">
        <div className="authpage-brand">
          <span aria-hidden>✦</span> orire
        </div>
        <Suspense fallback={<p className="authpage-sub">Loading…</p>}>
          <ResetForm />
        </Suspense>
      </div>
    </main>
  );
}
