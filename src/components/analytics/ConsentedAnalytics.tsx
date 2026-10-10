"use client";

import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { MetaPixel } from "./MetaPixel";
import { useConsent } from "@/lib/consent/consent";

/**
 * All non-essential third-party tracking, loaded only after the visitor has
 * granted consent. Gating the *loading* here is enough: every event call
 * elsewhere (Vercel `track`, `metaTrack`) is a safe no-op while these scripts
 * are absent, so no call site needs its own guard.
 */
export function ConsentedAnalytics() {
  const { consent } = useConsent();
  if (consent !== "granted") return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
      <Script
        src="https://static.cloudflareinsights.com/beacon.min.js"
        strategy="afterInteractive"
        data-cf-beacon='{"token":"7cc9c5b7f7ea4b2fba6d772b8fb06394"}'
      />
      <MetaPixel />
    </>
  );
}
