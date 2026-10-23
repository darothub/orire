import { readConsent } from "@/lib/consent/consent";
import { analytics } from "./events";

const KEY = "orire-signup-tracked";
/** Keep the existing local marker; the account ID is never an analytics property. */
export function trackNewSignup(fresh: boolean, id: string | null | undefined): boolean {
  if (readConsent() !== "granted" || !fresh || !id) return false;
  try {
    if (window.localStorage.getItem(KEY) === id) return false;
    window.localStorage.setItem(KEY, id);
    if (analytics.signupCompleted()) return true;
    window.localStorage.removeItem(KEY);
  } catch {
    // No reliable deduplication: skip rather than double-count.
  }
  return false;
}
