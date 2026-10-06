"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { analytics } from "@/lib/analytics/events";

const KEY = "orire-signup-tracked";

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
  const fresh = data?.isNewUser ?? isNewUser;
  const id = data?.user?.id ?? userId;

  useEffect(() => {
    if (!fresh || !id) return;
    try {
      if (window.localStorage.getItem(KEY) === id) return;
      window.localStorage.setItem(KEY, id);
    } catch {
      // Without storage we can't dedupe, so skip rather than double-count.
      return;
    }
    analytics.signupCompleted();
  }, [fresh, id]);

  return null;
}
