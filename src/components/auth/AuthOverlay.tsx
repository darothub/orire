"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { useSession, signIn } from "next-auth/react";
import { useUIStore } from "@/lib/store/uiStore";
import { getTemplate } from "@/components/templates/registry";
import { sampleCV } from "@/lib/cv/sample";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Remembers that the user passed the gate by choosing to explore (not nag on reload). */
const EXPLORED_KEY = "orire.auth.explored";
function hasExplored() {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(EXPLORED_KEY) === "1";
  } catch {
    return false;
  }
}
function markExplored() {
  try {
    window.localStorage.setItem(EXPLORED_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** OAuth providers we surface as one-tap buttons, in display order. */
// GitHub is disabled for now. To bring it back: restore the `import GitHub` and
// provider block in src/lib/auth/auth.ts, re-add a GitHubMark icon, and add
// `{ id: "github", label: "GitHub", mark: <GitHubMark /> }` to this array.
const OAUTH = [
  { id: "google", label: "Google", mark: <GoogleMark /> },
] as const;

/**
 * Full-screen login / sign-up page shown as a dismissible overlay. The backdrop
 * is transparent + blurred so the app's animated ambient (plus the drifting
 * aurora orbs below) shows through, matching the lively feel of the Refine flow.
 * OAuth buttons light up only for providers configured on the server; the email
 * magic-link always works (prints to the dev terminal with no SMTP).
 */
export function AuthOverlay() {
  const open = useUIStore((s) => s.authOpen);
  const mode = useUIStore((s) => s.authMode);
  const close = useUIStore((s) => s.closeAuth);
  const openAuth = useUIStore((s) => s.openAuth);
  const setMode = openAuth;
  const { status } = useSession();

  const [configured, setConfigured] = useState<string[] | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Which OAuth providers are actually enabled on the server (env-driven).
  useEffect(() => {
    if (!open || configured) return;
    let alive = true;
    fetch("/api/auth/providers")
      .then((r) => (r.ok ? r.json() : {}))
      .then((j: Record<string, unknown>) => alive && setConfigured(Object.keys(j ?? {})))
      .catch(() => alive && setConfigured([]));
    return () => {
      alive = false;
    };
  }, [open, configured]);

  // Close automatically once the user is signed in.
  useEffect(() => {
    if (status === "authenticated" && open) close();
  }, [status, open, close]);

  // Gate: auto-open on first load when signed out, until the user signs in or
  // chooses to explore. Once they've explored, we don't nag on later reloads.
  useEffect(() => {
    if (status === "unauthenticated" && !hasExplored()) openAuth("signin");
  }, [status, openAuth]);

  // Dismissing the gate (×, backdrop, Esc, "explore") counts as choosing to
  // explore so it won't reappear on reload. Signing in bypasses this naturally.
  const dismiss = () => {
    if (status !== "authenticated") markExplored();
    close();
  };
  // Reset transient state when the overlay closes (render-phase, no effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setSent(false);
      setBusy(null);
    }
  }

  // Esc to dismiss.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, status]);

  const signup = mode === "signup";

  const oauth = (id: string) => {
    setBusy(id);
    void signIn(id, { callbackUrl: "/" });
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy("email");
    try {
      await signIn("nodemailer", { email: email.trim(), redirect: false });
      setSent(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="auth-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
          onMouseDown={(e) => e.target === e.currentTarget && dismiss()}
          role="dialog"
          aria-modal="true"
          aria-label={signup ? "Create your orire account" : "Sign in to orire"}
        >
          {/* Living template showcase — orire's own CVs drift behind the card. */}
          <Showcase />
          <div className="auth-scrim" aria-hidden />

          <motion.div
            className="auth-card"
            initial={{ opacity: 0, y: 24, scale: 0.96, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 16, scale: 0.97, filter: "blur(8px)" }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <button className="auth-close" onClick={dismiss} aria-label="Close">
              ×
            </button>

            <div className="auth-brand">
              <span className="auth-brand-mark">✦</span>
              <span className="auth-brand-name">orire</span>
            </div>

            <div className="auth-switch" role="tablist" aria-label="Sign in or create account">
              <button
                role="tab"
                aria-selected={!signup}
                className={`auth-switch-btn ${!signup ? "is-on" : ""}`}
                onClick={() => setMode("signin")}
              >
                Sign in
              </button>
              <button
                role="tab"
                aria-selected={signup}
                className={`auth-switch-btn ${signup ? "is-on" : ""}`}
                onClick={() => setMode("signup")}
              >
                Create account
              </button>
              <motion.span
                className="auth-switch-pill"
                initial={false}
                animate={{ x: signup ? "100%" : "0%" }}
                transition={{ duration: 0.32, ease: EASE }}
              />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={signup ? "up" : "in"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.26, ease: EASE }}
                className="auth-head"
              >
                <h1>{signup ? "Create your account" : "Welcome back"}</h1>
                <p>
                  {signup
                    ? "Save your CVs to the cloud, compare assistants and unlock plan features."
                    : "Sign in to sync your CVs and pick up right where you left off."}
                </p>
              </motion.div>
            </AnimatePresence>

            {sent ? (
              <motion.div
                className="auth-sent"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <div className="auth-sent-ico">✉</div>
                <strong>Check your inbox</strong>
                <span>
                  We sent a sign-in link to <b>{email}</b>. In local dev it prints to the server
                  terminal.
                </span>
                <button className="auth-link" onClick={() => setSent(false)}>
                  Use a different method
                </button>
              </motion.div>
            ) : (
              <>
                <div className="auth-oauth">
                  {OAUTH.map((p) => {
                    const ready = configured?.includes(p.id) ?? false;
                    const loading = busy === p.id;
                    return (
                      <button
                        key={p.id}
                        className={`auth-oauth-btn ${p.id}`}
                        onClick={() => ready && oauth(p.id)}
                        disabled={!!busy || !ready}
                        title={ready ? `Continue with ${p.label}` : `${p.label} sign-in isn't configured on this server`}
                      >
                        <span className="auth-oauth-mark">{p.mark}</span>
                        <span>
                          {loading ? "Redirecting…" : `${signup ? "Sign up" : "Continue"} with ${p.label}`}
                        </span>
                        {!ready && configured !== null && <span className="auth-oauth-soon">soon</span>}
                      </button>
                    );
                  })}
                </div>

                <div className="auth-divider">
                  <span>or {signup ? "sign up" : "continue"} with email</span>
                </div>

                <form className="auth-email" onSubmit={submitEmail}>
                  <input
                    type="email"
                    className="auth-input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                  <button className="auth-submit" type="submit" disabled={busy === "email"}>
                    {busy === "email"
                      ? "Sending…"
                      : signup
                        ? "Email me a sign-up link"
                        : "Email me a sign-in link"}
                  </button>
                </form>

                <p className="auth-fine">
                  Your AI API keys never leave your browser. By continuing you agree to use orire
                  responsibly.
                </p>
                <button className="auth-skip" onClick={dismiss}>
                  Explore without an account →
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* Curated, visually distinct templates distributed across parallax columns. */
const SHOWCASE_COLUMNS: { ids: string[]; dur: number; dir: 1 | -1 }[] = [
  { ids: ["aurora", "imperial", "carbon", "sapphire"], dur: 52, dir: 1 },
  { ids: ["noir", "oxford", "marigold", "plum"], dur: 66, dir: -1 },
  { ids: ["vertex", "bordeaux", "crimson", "consul"], dur: 58, dir: 1 },
];

function Showcase() {
  return (
    <motion.div
      className="auth-showcase"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.9, ease: EASE }}
    >
      <MotionConfig reducedMotion="always">
        {SHOWCASE_COLUMNS.map((col, i) => (
          <div
            key={i}
            className={`sc-col ${col.dir > 0 ? "sc-up" : "sc-down"}`}
            style={{ ["--dur" as string]: `${col.dur}s` }}
          >
            {[...col.ids, ...col.ids].map((id, j) => (
              <ShowcaseCard key={`${id}-${j}`} id={id} />
            ))}
          </div>
        ))}
      </MotionConfig>
    </motion.div>
  );
}

function ShowcaseCard({ id }: { id: string }) {
  const t = getTemplate(id);
  const Component = t.Component;
  return (
    <div className="sc-card">
      <div className="sc-scale">
        <div className="paper sc-paper">
          <Component cv={sampleCV} />
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.71A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
