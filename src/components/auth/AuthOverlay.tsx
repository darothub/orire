"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSession, signIn } from "next-auth/react";
import { BrandMark } from "@/components/BrandMark";
import { useUIStore } from "@/lib/store/uiStore";
import { CvShowcase } from "@/components/landing/CvShowcase";
import { TurnstileWidget, TURNSTILE_SITE_KEY } from "@/components/auth/TurnstileWidget";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { listFocusable, pickInitialFocus } from "@/components/auth/authFocus";
import { TEMPLATE_COUNT } from "@/lib/templates/catalog";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Legacy "explore without an account" flag. Anonymous exploration has been
 * removed (the free quota must be tied to an account so it can't be reset by
 * switching browsers), but sign-out still clears this key to tidy up any value
 * left in storage from older builds.
 */
const EXPLORED_KEY = "orire.auth.explored";
export function clearExplored() {
  try {
    window.localStorage.removeItem(EXPLORED_KEY);
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
 * Email + password sign-in is hidden for now because there's no SMTP wired up,
 * so we can't offer password reset yet. Re-enable by setting
 * NEXT_PUBLIC_PASSWORD_AUTH=true (no code change) once reset email works.
 */
const PASSWORD_AUTH_ENABLED = process.env.NEXT_PUBLIC_PASSWORD_AUTH === "true";

/**
 * Login / sign-up overlay, opened on demand from the public landing page (or
 * the account menu). The backdrop reuses the drifting CV showcase + scrim so it
 * matches the landing, and it is dismissable (close button or Esc) back to the
 * landing. OAuth buttons light up only for providers configured on the server.
 * An account is still required to use the workspace, so the free quota can be
 * enforced server-side per user — the landing is the only public surface.
 */
export function AuthOverlay() {
  const open = useUIStore((s) => s.authOpen);
  const mode = useUIStore((s) => s.authMode);
  const close = useUIStore((s) => s.closeAuth);
  const openAuth = useUIStore((s) => s.openAuth);
  /** Switch tabs without clearing `intendedPlan` (openAuth defaults plan to null). */
  const setMode = (next: "signin" | "signup") => {
    useUIStore.setState({ authMode: next });
  };
  const { status } = useSession();

  const [configured, setConfigured] = useState<string[] | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [authErr, setAuthErr] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();
  const panelId = useId();

  // Which OAuth providers are actually enabled on the server (env-driven).
  // Retry on an empty/failed response instead of caching it — otherwise a
  // single race during server start-up would strand a configured provider
  // (e.g. Google) behind a permanent "soon" badge until a full reload.
  useEffect(() => {
    if (!open) return;
    if (configured && configured.length > 0) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const load = () => {
      fetch("/api/auth/providers")
        .then((r) => (r.ok ? r.json() : {}))
        .then((j: Record<string, unknown>) => {
          if (!alive) return;
          const ids = Object.keys(j ?? {});
          const hasOAuth = ids.some((id) => id !== "credentials");
          if (hasOAuth || attempts >= 5) {
            setConfigured(ids);
            return;
          }
          // No OAuth provider yet — keep `configured` null (no "soon" flash)
          // and retry with backoff in case the server is still warming up.
          attempts += 1;
          timer = setTimeout(load, 400 * attempts);
        })
        .catch(() => {
          if (!alive) return;
          if (attempts < 5) {
            attempts += 1;
            timer = setTimeout(load, 400 * attempts);
          } else {
            setConfigured([]);
          }
        });
    };
    load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [open, configured]);

  // Close automatically once the user is signed in.
  useEffect(() => {
    if (status === "authenticated" && open) close();
  }, [status, open, close]);

  // The overlay is opened on demand — by the landing page's CTAs, the account
  // menu, or the "/?signin=1" link from the forgot/reset pages. It is no longer
  // a mandatory gate: an unauthenticated visitor sees the public landing page
  // and chooses to sign in, and can dismiss the overlay back to it.
  //
  // The "Back to sign in" links on the forgot/reset pages land on "/?signin=1";
  // honour it by opening the sign-in tab, then strip the param so a reload
  // doesn't keep re-triggering it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("signin") === null) return;
    openAuth("signin");
    const params = new URLSearchParams(window.location.search);
    params.delete("signin");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash,
    );
  }, [openAuth]);
  // Reset transient state when the overlay closes (render-phase, no effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setBusy(null);
      setCaptchaToken(null);
      setAuthErr(null);
    }
  }

  // Esc dismisses the overlay back to the landing page.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Lock background scroll while the modal owns the viewport.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // A11y: on open, move focus into the dialog (primary field / OAuth — not the
  // landing CTA and not Back/Close chrome); on close, restore the opener.
  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    openerRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
    const t = window.setTimeout(() => {
      const card = cardRef.current;
      if (!card) return;
      pickInitialFocus(card).focus();
    }, 60);
    return () => {
      window.clearTimeout(t);
      const opener = openerRef.current;
      openerRef.current = null;
      // Only restore if the node is still mounted (route changes may remove it).
      if (opener && document.contains(opener)) {
        try {
          opener.focus();
        } catch {
          /* ignore */
        }
      }
    };
  }, [open]);

  // A11y: trap Tab focus within the dialog while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const card = cardRef.current;
      if (!card) return;
      const items = listFocusable(card);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && card.contains(active);
      if (!inside) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  const signup = mode === "signup";
  const captchaOn = !!TURNSTILE_SITE_KEY;

  // Verify the solved Turnstile token server-side (sets the short-lived cookie
  // the auth backend checks). Shared by Google OAuth and email sign-in.
  const passCaptcha = async (): Promise<boolean> => {
    if (!captchaOn) return true;
    if (!captchaToken) {
      setAuthErr("Please complete the verification challenge.");
      return false;
    }
    const vr = await fetch("/api/auth/turnstile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: captchaToken }),
    });
    const vj = await vr.json().catch(() => ({}));
    if (!vr.ok || vj?.ok === false) {
      setAuthErr(vj?.error ? String(vj.error) : "Verification failed. Please try again.");
      setCaptchaToken(null);
      setCaptchaReset((n) => n + 1);
      return false;
    }
    return true;
  };

  const oauth = async (id: string) => {
    if (busy) return;
    setBusy(id);
    setAuthErr(null);
    if (!(await passCaptcha())) {
      setBusy(null);
      return;
    }
    void signIn(id, { callbackUrl: "/" });
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || busy) return;
    setBusy("email");
    setAuthErr(null);
    try {
      if (!(await passCaptcha())) return;

      // Sign-up first creates the account, then we sign in with the same creds.
      if (signup) {
        const sr = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const sj = await sr.json().catch(() => ({}));
        if (!sr.ok) {
          setAuthErr(sj?.error ? String(sj.error) : "Could not create your account.");
          return;
        }
      }

      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setAuthErr(
          signup
            ? "Account created, but automatic sign-in failed. Please sign in."
            : "Invalid email or password.",
        );
        if (captchaOn) {
          setCaptchaToken(null);
          setCaptchaReset((n) => n + 1);
        }
        return;
      }
      // Success — the authenticated effect closes the overlay.
    } catch (err) {
      setAuthErr((err as Error)?.message ?? "Something went wrong. Please try again.");
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
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={authErr ? errorId : undefined}
        >
          {/* Living template showcase — orire's own CVs drift behind the card. */}
          <CvShowcase />
          <div className="auth-scrim" aria-hidden />

          <div className="auth-stage">
          <motion.div
            className="auth-card"
            ref={cardRef}
            tabIndex={-1}
            initial={{ opacity: 0, y: 24, scale: 0.96, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 16, scale: 0.97, filter: "blur(8px)" }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <button
              type="button"
              className="auth-back"
              onClick={close}
              aria-label="Back to the landing page"
            >
              <span aria-hidden>←</span> Back
            </button>
            <button
              type="button"
              className="auth-close"
              onClick={close}
              aria-label="Close and return to the landing page"
              title="Close"
            >
              ×
            </button>
            <ThemeToggle className="auth-theme" />

            <div className="auth-brand">
              <span className="auth-brand-mark"><BrandMark size={30} /></span>
              <span className="auth-brand-name">Orire</span>
            </div>

            <div
              className="auth-switch"
              role="tablist"
              aria-label="Sign in or create account"
              onKeyDown={(e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") {
                  return;
                }
                e.preventDefault();
                const next =
                  e.key === "Home" || e.key === "ArrowLeft"
                    ? "signin"
                    : e.key === "End" || e.key === "ArrowRight"
                      ? "signup"
                      : mode;
                if (next !== mode) setMode(next);
              }}
            >
              <button
                type="button"
                id={`${panelId}-tab-signin`}
                role="tab"
                aria-selected={!signup}
                aria-controls={panelId}
                tabIndex={signup ? -1 : 0}
                className={`auth-switch-btn ${!signup ? "is-on" : ""}`}
                onClick={() => setMode("signin")}
              >
                Sign in
              </button>
              <button
                type="button"
                id={`${panelId}-tab-signup`}
                role="tab"
                aria-selected={signup}
                aria-controls={panelId}
                tabIndex={signup ? 0 : -1}
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
                aria-hidden
              />
            </div>

            <div id={panelId} role="tabpanel" aria-labelledby={signup ? `${panelId}-tab-signup` : `${panelId}-tab-signin`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={signup ? "up" : "in"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.26, ease: EASE }}
                className="auth-head"
              >
                <h1 id={titleId}>{signup ? "Create your account" : "Welcome back"}</h1>
                <p>
                  {signup
                    ? "Save your CVs to the cloud, compare assistants and unlock plan features."
                    : "Sign in to sync your CVs and pick up right where you left off."}
                </p>
              </motion.div>
            </AnimatePresence>

            {PASSWORD_AUTH_ENABLED && (
            <form className="auth-email" onSubmit={submitEmail}>
              <div className="auth-field">
                <label className="auth-label" htmlFor={emailId}>
                  Email
                </label>
                <input
                  id={emailId}
                  type="email"
                  className="auth-input"
                  name="email"
                  data-auth-initial-focus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  aria-invalid={authErr ? true : undefined}
                  aria-describedby={authErr ? errorId : undefined}
                />
              </div>
              <div className="auth-field">
                <label className="auth-label" htmlFor={passwordId}>
                  Password
                </label>
                <PasswordInput
                  id={passwordId}
                  className="auth-input"
                  name="password"
                  placeholder={signup ? "At least 8 characters" : "Your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={signup ? "new-password" : "current-password"}
                  minLength={signup ? 8 : undefined}
                  required
                  aria-invalid={authErr ? true : undefined}
                  aria-describedby={authErr ? errorId : undefined}
                />
              </div>
              {captchaOn && (
                <div className="auth-captcha-frame">
                  <span className="auth-captcha-label" id={`${panelId}-captcha`}>
                    <span aria-hidden>🛡</span> Quick security check
                  </span>
                  <TurnstileWidget
                    onToken={(t) => { setCaptchaToken(t); setAuthErr(null); }}
                    onExpire={() => setCaptchaToken(null)}
                    resetKey={captchaReset}
                  />
                </div>
              )}
              <button className="auth-submit" type="submit" disabled={busy === "email"}>
                {busy === "email"
                  ? signup
                    ? "Creating account…"
                    : "Signing in…"
                  : signup
                    ? "Create account"
                    : "Sign in"}
              </button>
              {!signup && (
                <a className="auth-forgot" href="/forgot">
                  Forgot password?
                </a>
              )}
            </form>
            )}

            {captchaOn && !PASSWORD_AUTH_ENABLED && (
              <div className="auth-captcha-frame">
                <span className="auth-captcha-label">
                  <span aria-hidden>🛡</span> Quick security check
                </span>
                <TurnstileWidget
                  onToken={(t) => { setCaptchaToken(t); setAuthErr(null); }}
                  onExpire={() => setCaptchaToken(null)}
                  resetKey={captchaReset}
                />
              </div>
            )}

            <div className="auth-divider" hidden={!PASSWORD_AUTH_ENABLED}>
              <span>or {signup ? "sign up" : "continue"} with Google</span>
            </div>

            <div className="auth-oauth">
              {OAUTH.map((p) => {
                const ready = configured?.includes(p.id) ?? false;
                const loading = busy === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`auth-oauth-btn ${p.id}`}
                    onClick={() => ready && oauth(p.id)}
                    disabled={!!busy || !ready}
                    data-auth-initial-focus={
                      !PASSWORD_AUTH_ENABLED && ready ? true : undefined
                    }
                    title={ready ? `Continue with ${p.label}` : `${p.label} sign-in isn't configured on this server`}
                    aria-label={
                      loading
                        ? `Redirecting to ${p.label}`
                        : `${signup ? "Sign up" : "Continue"} with ${p.label}${ready ? "" : " (not configured)"}`
                    }
                  >
                    <span className="auth-oauth-mark" aria-hidden>
                      {p.mark}
                    </span>
                    <span aria-hidden>
                      {loading ? "Redirecting…" : `${signup ? "Sign up" : "Continue"} with ${p.label}`}
                    </span>
                    {!ready && configured !== null && (
                      <span className="auth-oauth-soon" aria-hidden>
                        soon
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {authErr && (
              <p id={errorId} className="auth-error" role="alert">
                {authErr}
              </p>
            )}

            <p className="auth-fine">
              By continuing you agree to use Orire responsibly.
            </p>
            </div>
          </motion.div>

          <ul className="auth-usps" aria-label="What Orire does">
            <li><span aria-hidden>✎</span> Rebrand any CV into a clean, ATS-ready layout</li>
            <li><span aria-hidden>✦</span> Tailor it to any job with built-in AI</li>
            <li><span aria-hidden>❖</span> {TEMPLATE_COUNT} standout templates, live preview as you edit</li>
          </ul>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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
