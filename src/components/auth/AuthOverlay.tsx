"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { useSession, signIn } from "next-auth/react";
import { useUIStore } from "@/lib/store/uiStore";
import { getTemplate } from "@/components/templates/registry";
import { sampleCV } from "@/lib/cv/sample";
import { TurnstileWidget, TURNSTILE_SITE_KEY } from "@/components/auth/TurnstileWidget";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

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
/** Forget the "explored" choice so the sign-in gate shows again (e.g. after sign out). */
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
 * Full-screen login / sign-up page shown as a dismissible overlay. The backdrop
 * is transparent + blurred so the app's animated ambient (plus the drifting
 * aurora orbs below) shows through, matching the lively feel of the Refine flow.
 * OAuth buttons light up only for providers configured on the server; email +
 * password sign-in and sign-up are always available.
 */
export function AuthOverlay() {
  const open = useUIStore((s) => s.authOpen);
  const mode = useUIStore((s) => s.authMode);
  const close = useUIStore((s) => s.closeAuth);
  const openAuth = useUIStore((s) => s.openAuth);
  const setExplored = useUIStore((s) => s.setExplored);
  const setMode = openAuth;
  const { status } = useSession();

  const [configured, setConfigured] = useState<string[] | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [authErr, setAuthErr] = useState<string | null>(null);

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

  // Gate: auto-open on first load when not signed in, until the user signs in or
  // chooses to explore. We hydrate the shared `explored` flag from localStorage
  // on mount so the page-level gate knows immediately whether to keep the
  // workspace hidden. We trigger during the `loading` phase too (not just once
  // `unauthenticated` resolves) so the overlay appears immediately and the
  // landing page isn't briefly visible/interactive first.
  useEffect(() => {
    if (hasExplored()) setExplored(true);
  }, [setExplored]);
  // An explicit "sign in" entry point (e.g. the "Back to sign in" links on the
  // forgot/reset pages) lands on "/?signin=1". Honour it even if the visitor
  // previously chose to explore: forget that choice, force the overlay open,
  // then strip the param so a reload doesn't keep re-triggering it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("signin") === null) return;
    clearExplored();
    setExplored(false);
    if (status !== "authenticated") openAuth("signin");
    params.delete("signin");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash,
    );
  }, [status, openAuth, setExplored]);
  useEffect(() => {
    if (status !== "authenticated" && !hasExplored()) openAuth("signin");
  }, [status, openAuth]);

  // Dismissing the gate (×, backdrop, Esc, "explore") counts as choosing to
  // explore so it won't reappear on reload. Signing in bypasses this naturally.
  const dismiss = () => {
    if (status !== "authenticated") {
      markExplored();
      setExplored(true);
    }
    close();
  };
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
          onMouseDown={(e) => e.target === e.currentTarget && dismiss()}
          role="dialog"
          aria-modal="true"
          aria-label={signup ? "Create your orire account" : "Sign in to orire"}
        >
          {/* Living template showcase — orire's own CVs drift behind the card. */}
          <Showcase />
          <div className="auth-scrim" aria-hidden />

          <div className="auth-stage">
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
            <ThemeToggle className="auth-theme" />

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

            {PASSWORD_AUTH_ENABLED && (
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
              <input
                type="password"
                className="auth-input"
                placeholder={signup ? "Create a password (min 8 characters)" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={signup ? 8 : undefined}
                required
              />
              {captchaOn && (
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

            {authErr && <p className="auth-error" role="alert">{authErr}</p>}

            <p className="auth-fine">
              By continuing you agree to use orire responsibly.
            </p>
            <button className="auth-skip" onClick={dismiss}>
              Explore without an account →
            </button>
          </motion.div>

          <ul className="auth-usps" aria-label="What orire does">
            <li><span aria-hidden>✎</span> Rebrand any CV into a clean, ATS-ready layout</li>
            <li><span aria-hidden>✦</span> Tailor it to any job with built-in AI</li>
            <li><span aria-hidden>❖</span> 20 standout templates, live preview as you edit</li>
          </ul>
          </div>
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
