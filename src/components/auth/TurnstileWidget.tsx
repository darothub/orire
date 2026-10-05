"use client";

import { useEffect, useRef } from "react";

/** Public site key — captcha only renders when this is configured at build. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit";

let scriptAdded = false;
const waiters: Array<() => void> = [];

/** Load the Turnstile script once and resolve when the API is ready. */
function whenReady(cb: () => void) {
  if (typeof window === "undefined") return;
  if (window.turnstile) return cb();
  waiters.push(cb);
  if (scriptAdded) return;
  scriptAdded = true;
  window.onTurnstileLoad = () => {
    while (waiters.length) waiters.shift()!();
  };
  const s = document.createElement("script");
  s.src = SCRIPT_SRC;
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
}

/**
 * Invisible/managed Cloudflare Turnstile widget. Calls `onToken` with a fresh
 * token each time the challenge solves, and `onExpire` when it lapses. Renders
 * nothing when no site key is configured (captcha disabled).
 */
export function TurnstileWidget({
  onToken,
  onExpire,
  resetKey = 0,
}: {
  onToken: (token: string) => void;
  onExpire?: () => void;
  resetKey?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !ref.current) return;
    const el = ref.current;
    let removed = false;
    whenReady(() => {
      if (removed || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(el, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "auto",
        callback: (token: string) => onToken(token),
        "expired-callback": () => onExpire?.(),
        "error-callback": () => onExpire?.(),
      });
    });
    return () => {
      removed = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* ignore */
        }
        widgetId.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!TURNSTILE_SITE_KEY) return null;
  return <TurnstileInner elRef={ref} widgetId={widgetId} resetKey={resetKey} />;
}

/** Separate node so the reset effect can depend on `resetKey` cleanly. */
function TurnstileInner({
  elRef,
  widgetId,
  resetKey,
}: {
  elRef: React.RefObject<HTMLDivElement | null>;
  widgetId: React.RefObject<string | null>;
  resetKey: number;
}) {
  useEffect(() => {
    if (resetKey > 0 && widgetId.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetId.current);
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);
  return <div ref={elRef} className="auth-captcha" />;
}
