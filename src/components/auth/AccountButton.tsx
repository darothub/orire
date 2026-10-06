"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSession, signOut } from "next-auth/react";
import { useUIStore } from "@/lib/store/uiStore";
import { clearExplored } from "@/components/auth/AuthOverlay";
import { deleteAccount } from "@/app/actions/account";

/**
 * Account control in the app bar. Signed out → opens the full-screen login /
 * sign-up overlay (with Google + email). Signed in → identity + cloud status +
 * sign out.
 */
export function AccountButton() {
  const { data: session, status } = useSession();
  const openAuth = useUIStore((s) => s.openAuth);
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const res = await deleteAccount();
    if (res.error) {
      setDeleting(false);
      setDeleteError(res.error);
      return;
    }
    clearExplored();
    await signOut({ callbackUrl: "/" });
  }

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
          onClick={() => setOpen((o) => { const next = !o; if (!next) { setConfirmDelete(false); setDeleteError(null); } return next; })}
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
              <button
                className="flow-btn ghost sm"
                onClick={() => {
                  setOpen(false);
                  clearExplored();
                  void signOut({ callbackUrl: "/" });
                }}
              >
                Sign out
              </button>

              <div className="acct-pop-danger">
                {!confirmDelete ? (
                  <button
                    className="acct-del-link"
                    onClick={() => { setConfirmDelete(true); setDeleteError(null); }}
                  >
                    Delete account
                  </button>
                ) : (
                  <div className="acct-del-confirm">
                    <p className="acct-del-warn">
                      This permanently deletes your account, CVs, history and subscription. This can’t be undone.
                    </p>
                    {deleteError && <p className="acct-del-error">{deleteError}</p>}
                    <div className="acct-del-actions">
                      <button
                        className="flow-btn ghost sm"
                        onClick={() => { setConfirmDelete(false); setDeleteError(null); }}
                        disabled={deleting}
                      >
                        Cancel
                      </button>
                      <button
                        className="acct-del-btn"
                        onClick={() => void handleDelete()}
                        disabled={deleting}
                      >
                        {deleting ? "Deleting…" : "Delete permanently"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Signed out
  return (
    <div className="acct-wrap acct-signedout">
      {process.env.NODE_ENV !== "production" && (
        <a
          className="btn-ghost acct-devlogin"
          title="Dev only — sign in as a full-access (career) account"
          href="/api/dev/login"
        >
          ⚡ Dev login
        </a>
      )}
      <button className="btn-ghost" onClick={() => openAuth("signin")}>
        Sign in
      </button>
      <button className="btn-cta acct-signup" onClick={() => openAuth("signup")}>
        Sign up
      </button>
    </div>
  );
}
