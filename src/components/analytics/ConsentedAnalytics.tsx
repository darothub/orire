"use client";

import { privateAnalyticsEvent } from "@/lib/analytics/privacy";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { MetaPixel } from "./MetaPixel";
import { useConsent } from "@/lib/consent/consent";

/**
 * All non-essential third-party tracking, loaded only after the visitor has
 * granted consent. Event helpers also check the current choice: unmounting
 * script components cannot unload third-party functions after withdrawal.
 */
export function ConsentedAnalytics() {
  const { consent } = useConsent();
  if (consent !== "granted") return null;

  return (
    <>
      <Analytics beforeSend={privateAnalyticsEvent} />
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
