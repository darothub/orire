import { readConsent } from "@/lib/consent/consent";
import { getAttribution } from "./attribution";

/**
 * Meta (Facebook/Instagram) Pixel helpers. Everything here is a safe no-op on
 * the server and when the pixel isn't loaded (no `NEXT_PUBLIC_META_PIXEL_ID`,
 * or an ad blocker), so call sites never need to guard.
 */

type Fbq = (...args: unknown[]) => void;

const rawPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
// Pixel ids are numeric; anything else is ignored rather than injected into a script.
export const META_PIXEL_ID = /^\d{5,20}$/.test(rawPixelId) ? rawPixelId : "";

/** Standard events we fire; Meta optimises ad delivery against these names. */
export type MetaStandardEvent = "PageView" | "CompleteRegistration" | "InitiateCheckout" | "Purchase";

function fbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const f = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof f === "function" ? f : null;
}

/**
 * Fire a standard event. Stored UTM params ride along as custom data so they're
 * available for custom conversions and breakdowns. `eventID` lets Meta dedupe
 * if the same event is ever also sent server-side.
 */
export function metaTrack(
  event: MetaStandardEvent,
  data: Record<string, string | number | boolean> = {},
  eventID?: string,
): void {
  if (readConsent() !== "granted") return;
  const f = fbq();
  if (!f) return;
  const { fbclid: _omit, ...utm } = getAttribution();
  void _omit;
  f("track", event, { ...utm, ...data }, eventID ? { eventID } : undefined);
}
