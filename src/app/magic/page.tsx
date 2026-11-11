"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { BrandMark } from "@/components/BrandMark";

function MagicExchange() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [failed, setFailed] = useState(!token);
  // The token is single-use; guard against effect double-invocation.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    signIn("magic-link", { token, redirect: false })
      .then((res) => {
        if (res?.error || !res?.ok) setFailed(true);
        else window.location.replace("/");
      })
      .catch(() => setFailed(true));
  }, [token]);

  if (failed) {
    return (
      <>
        <h1 className="authpage-title">Link expired</h1>
        <p className="authpage-sub">
          This sign-in link is invalid or has expired. Request a new one from the sign-in screen.
        </p>
        <Link className="authpage-back" href="/?signin=1">
          ← Back to sign in
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="authpage-title">Signing you in…</h1>
      <p className="authpage-sub" role="status">One moment while we verify your link.</p>
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
