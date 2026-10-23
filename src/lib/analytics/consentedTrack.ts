import { privateAnalyticsEvent } from "./privacy";
import { track } from "@vercel/analytics";
import { readConsent } from "@/lib/consent/consent";

/** Initialize the SDK's standard queue only after opt-in, before React script effects. */
export function consentedTrack(name: string, properties?: Record<string, string | number | boolean | null>): boolean {
  if (readConsent() !== "granted") return false;
  try {
    window.va = window.va ?? ((...args) => { (window.vaq = window.vaq ?? []).push(args); });
    // Install before the event, including when the SDK replays the queue in order.
    window.va("beforeSend", privateAnalyticsEvent);
    track(name, properties);
    return true;
  } catch {
    // Optional measurement must never interrupt product actions.
    return false;
  }
}
