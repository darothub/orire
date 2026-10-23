import type { BeforeSend } from "@vercel/analytics";
import { readConsent } from "@/lib/consent/consent";

/** Strip URL queries/fragments and private path identifiers from SDK envelopes too. */
export const privateAnalyticsEvent: BeforeSend = (event) => {
  if (readConsent() !== "granted") return null;
  try {
    const url = new URL(event.url);
    url.search = "";
    url.hash = "";
    if (url.pathname.startsWith("/cv/")) url.pathname = "/cv/shared";
    if (url.pathname.startsWith("/api/")) return null;
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
};
