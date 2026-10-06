"use client";

import { useEffect, useState } from "react";

interface Status {
  signedIn: boolean;
  verified: boolean;
  email?: string | null;
}

type Notice = { kind: "ok" | "err"; text: string } | null;

/**
 * Sticky notice for signed-in users whose email isn't verified yet. The free
 * quota is locked server-side until they confirm, so this explains why and lets
 * them resend the link. It also surfaces the ?verified / ?verify_error results
 * of clicking the email link, then cleans those params out of the URL.
 */
export function VerifyBanner() {
  const [status, setStatus] = useState<Status | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    // Read the verify-link result from the URL once, then strip the params.
    const url = new URL(window.location.href);
    const verified = url.searchParams.get("verified");
    const err = url.searchParams.get("verify_error");
    const initialNotice: Notice = verified
      ? { kind: "ok", text: "Email verified — your free runs are unlocked." }
      : err
        ? { kind: "err", text: err }
        : null;
    if (verified || err) {
      url.searchParams.delete("verified");
      url.searchParams.delete("verify_error");
      window.history.replaceState({}, "", url.toString());
    }

    const load = (applyNotice: boolean) => {
      fetch("/api/auth/verify/status", { cache: "no-store" })
        .then((r) => r.json())
        .then((s: Status) => {
          if (!alive) return;
          setStatus(s);
          // Apply the URL-derived notice inside the async callback (never
          // synchronously in the effect body) to keep renders predictable.
          if (applyNotice && initialNotice) setNotice(initialNotice);
        })
        .catch(() => {
          /* ignore — banner just stays hidden */
        });
    };

    load(true);
    const onFocus = () => load(false);
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const resend = () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    fetch("/api/auth/verify/resend", { method: "POST" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setNotice(
          r.ok
            ? { kind: "ok", text: "Verification email sent. Check your inbox." }
            : { kind: "err", text: j?.error ?? "Could not resend the email." },
        );
      })
      .catch((e: unknown) => setNotice({ kind: "err", text: (e as Error).message }))
      .finally(() => setBusy(false));
  };

  // Hidden unless signed in and still unverified. A success notice can show
  // briefly even once verified (right after clicking the link).
  const showBar = Boolean(status?.signedIn && !status?.verified);
  if (!showBar && !notice) return null;

  const isOk = notice?.kind === "ok";
  return (
    <div
      role="status"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        flexWrap: "wrap",
        padding: "9px 16px",
        fontSize: 13.5,
        lineHeight: 1.4,
        color: isOk ? "#bbf7d0" : "#f4e9c9",
        background: isOk ? "rgba(16,36,24,0.96)" : "rgba(38,30,12,0.96)",
        borderBottom: `1px solid ${isOk ? "#1e5136" : "#4a3a16"}`,
        backdropFilter: "blur(6px)",
      }}
    >
      <span>
        {notice?.text ??
          "Verify your email to start your free runs — check your inbox for the link we sent."}
      </span>
      {showBar && !isOk && (
        <button
          type="button"
          onClick={resend}
          disabled={busy}
          style={{
            flexShrink: 0,
            background: "#8b7cff",
            color: "#0b0d12",
            fontWeight: 600,
            fontSize: 13,
            border: "none",
            borderRadius: 8,
            padding: "6px 14px",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "Sending…" : "Resend email"}
        </button>
      )}
    </div>
  );
}
