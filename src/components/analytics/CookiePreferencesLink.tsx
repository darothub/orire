"use client";

import { useConsent } from "@/lib/consent/consent";

/** Footer link that reopens the cookie banner so a visitor can change consent. */
export function CookiePreferencesLink() {
  const { reopen } = useConsent();
  return (
    <button type="button" className="cookie-prefs-link" onClick={reopen}>
      Cookie preferences
    </button>
  );
}
