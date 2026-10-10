"use client";

import Link from "next/link";
import { useConsent } from "@/lib/consent/consent";

/**
 * Opt-in cookie banner. Shown only when the visitor has not yet made a choice.
 * Accepting loads analytics + advertising scripts; declining keeps them off.
 */
export function CookieBanner() {
  const { consent, ready, setConsent } = useConsent();
  if (!ready || consent !== null) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Cookie consent" aria-live="polite">
      <p className="cookie-banner-text">
        We use essential cookies to run Orire. With your consent we also use
        analytics and advertising cookies to improve the product and measure our
        ads. Read our <Link href="/privacy">Privacy Policy</Link>.
      </p>
      <div className="cookie-banner-actions">
        <button
          type="button"
          className="cookie-btn cookie-btn-ghost"
          onClick={() => setConsent("denied")}
        >
          Decline
        </button>
        <button
          type="button"
          className="cookie-btn cookie-btn-solid"
          onClick={() => setConsent("granted")}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
