"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSession, signIn, signOut } from "next-auth/react";

/**
 * Account control in the app bar. Signed out → email magic-link sign-in popover
 * (in dev the link prints to the server terminal). Signed in → identity + cloud
 * status + sign out.
 */
export function AccountButton() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (status === "loading") {
    return <span className="acct-chip acct-loading" aria-hidden />;
  }

  if (status === "authenticated" && session?.user) {
    const label = session.user.email ?? session.user.name ?? "Account";
    const initial = (label[0] ?? "?").toUpperCase();
    return (
      <div className="acct-wrap">
        <button
          className="acct-chip"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          title={label}
        >
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.user.image} alt="" className="acct-avatar" />
          ) : (
            <span className="acct-avatar acct-avatar-fallback">{initial}</span>
          )}
          <span className="acct-email">{label}</span>
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              className="acct-pop"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="acct-pop-head">
                <strong>Signed in</strong>
                <span>{label}</span>
              </div>
              <div className="acct-pop-note">✓ Your CV auto-saves to the cloud.</div>
              <button className="flow-btn ghost sm" onClick={() => void signOut()}>
                Sign out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Signed out
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    try {
      await signIn("nodemailer", { email: email.trim(), redirect: false });
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="acct-wrap">
      {process.env.NODE_ENV !== "production" && (
        <a
          className="btn-ghost acct-devlogin"
          title="Dev only — sign in as a full-access (teams) account"
          href="/api/dev/login"
        >
          ⚡ Dev login
        </a>
      )}
      <button className="btn-ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Sign in
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="acct-pop"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            {sent ? (
              <div className="acct-pop-head">
                <strong>Check your inbox</strong>
                <span>We sent a sign-in link to {email}. (In local dev it prints to the terminal.)</span>
              </div>
            ) : (
              <form className="acct-form" onSubmit={submit}>
                <label className="ed-label">Sign in with email</label>
                <input
                  type="email"
                  className="acct-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
                <button className="flow-btn primary sm" type="submit" disabled={busy}>
                  {busy ? "Sending…" : "Send magic link"}
                </button>
                <span className="acct-form-note">
                  Save your CV to the cloud and unlock plan features. Your API keys stay in your
                  browser.
                </span>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
