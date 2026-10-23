"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useConsent } from "@/lib/consent/consent";
import { trackNewSignup } from "@/lib/analytics/signup";

/**
 * Reports a single sign-up conversion for the session that created the
 * account. Uses the live session so it also fires after an OAuth redirect or an
 * in-page email sign-up; the per-user storage flag prevents repeat events.
 */
export function SignupTracker({
  isNewUser,
  userId,
}: {
  isNewUser: boolean;
  userId: string | null;
}) {
  const { data } = useSession();
  const { consent } = useConsent();
  const fresh = data?.isNewUser ?? isNewUser;
  const id = data?.user?.id ?? userId;

  useEffect(() => {
    if (consent === "granted") trackNewSignup(fresh, id);
  }, [fresh, id, consent]);

  return null;
}
