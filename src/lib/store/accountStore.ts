"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { useUIStore } from "@/lib/store/uiStore";

/**
 * Shared client mirror of the server's account-status truth
 * (`/api/auth/verify/status`). Used to gate write/download actions: an account
 * whose email isn't verified may read and explore, but may not produce output
 * (download a PDF, run the AI, etc.). The real enforcement for metered actions
 * is server-side; this store drives the UX so unverified users are told what to
 * do rather than silently failing.
 */
interface AccountState {
  loaded: boolean;
  signedIn: boolean;
  verified: boolean;
  email: string | null;
  refresh: () => Promise<void>;
}

export const useAccountStore = create<AccountState>((set) => ({
  loaded: false,
  signedIn: false,
  verified: false,
  email: null,
  refresh: async () => {
    try {
      const res = await fetch("/api/auth/verify/status", { cache: "no-store" });
      const data = (await res.json()) as {
        signedIn?: boolean;
        verified?: boolean;
        email?: string;
      };
      set({
        loaded: true,
        signedIn: Boolean(data.signedIn),
        verified: Boolean(data.verified),
        email: data.email ?? null,
      });
    } catch {
      set((s) => ({ ...s, loaded: true }));
    }
  },
}));

export interface WriteGate {
  /** True once the status has been fetched. */
  ready: boolean;
  /** True when the account may perform write/download actions. */
  allowed: boolean;
  /** Why the action is blocked (null when allowed). */
  reason: string | null;
  /**
   * Call at the start of a write/download handler. Returns true when allowed;
   * otherwise opens the sign-up prompt (if needed) and returns false.
   */
  guard: () => boolean;
}

/**
 * Hook that fetches account status once and reports whether the caller may
 * perform a write/download action. Unverified (or signed-out) accounts are
 * blocked with a clear reason.
 */
export function useWriteGate(action = "download"): WriteGate {
  const loaded = useAccountStore((s) => s.loaded);
  const signedIn = useAccountStore((s) => s.signedIn);
  const verified = useAccountStore((s) => s.verified);
  const refresh = useAccountStore((s) => s.refresh);
  const openAuth = useUIStore((s) => s.openAuth);

  useEffect(() => {
    if (!loaded) void refresh();
  }, [loaded, refresh]);

  const allowed = signedIn && verified;
  const reason = !signedIn
    ? `Create an account and verify your email to ${action}.`
    : !verified
      ? `Verify your email to ${action} — check your inbox for the link, or resend it from the banner.`
      : null;

  const guard = (): boolean => {
    if (allowed) return true;
    if (!signedIn) openAuth("signup");
    return false;
  };

  return { ready: loaded, allowed, reason, guard };
}
