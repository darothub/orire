"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { BrandMark } from "@/components/BrandMark";

function MagicExchange() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [phase, setPhase] = useState<"ready" | "working" | "failed">(token ? "ready" : "failed");
  // The token is single-use, so one click makes one attempt.
  const started = useRef(false);

  // The link is only used when the person presses the button. Opening the page does nothing, so
  // an email scanner, a link preview or a second tab can't use up the link before they do.
  const signInNow = () => {
    if (!token || started.current) return;
    started.current = true;
    setPhase("working");
    signIn("magic-link", { token, redirect: false })
      .then((res) => {
        if (res?.error || !res?.ok) setPhase("failed");
        else window.location.replace("/");
      })
      .catch(() => setPhase("failed"));
  };

  if (phase === "failed") {
    return (
      <>
        <h1 className="authpage-title">This link can&apos;t be used</h1>
        <p className="authpage-sub">
          It may have expired (links last 15 minutes), been used already, or been replaced because you asked for a newer one.
          Request a new link and use the latest email.
        </p>
        <Link className="authpage-back" href="/?signin=1">
          ← Back to sign in
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="authpage-title">Sign in to Orire</h1>
      <p className="authpage-sub" role="status">
        {phase === "working" ? "Signing you in…" : "Press the button to finish signing in on this device."}
      </p>
      <button type="button" className="auth-submit" onClick={signInNow} disabled={phase === "working"}>
        {phase === "working" ? "Signing in…" : "Continue to Orire"}
      </button>
    </>
  );
}

export default function MagicPage() {
  return (
    <main className="authpage">
      <div className="authpage-card">
        <div className="authpage-brand">
          <BrandMark size={30} /> Orire
        </div>
        <Suspense fallback={<p className="authpage-sub">Loading…</p>}>
          <MagicExchange />
        </Suspense>
      </div>
    </main>
  );
}
