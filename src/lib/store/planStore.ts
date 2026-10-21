"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PlanId } from "@/lib/plan/plan";

/**
 * Why this store still mirrors a usage count, separately from `usageStore`:
 *
 * `usageStore` is a signed-in-only, server-authoritative mirror of EVERY
 * metered metric (refine/simulate/download) via `readUsage()`. It has no
 * notion of an anonymous trial — its `summary` is simply null when signed
 * out.
 *
 * `planStore` predates it and still owns the one thing `usageStore` can't:
 * the LOCAL, anonymous refine-trial counter (`refinesUsed`, reset monthly)
 * that lets a signed-out visitor try Refine before creating an account. Once
 * signed in, `refineUsed()` below switches to the server-mirrored count
 * instead — kept here (not read from `usageStore`) only so callers get one
 * seamless number across the anonymous→signed-in transition without caring
 * which backs it. This was previously named `usedThisMonth()`, which read as
 * a general usage figure and invited confusion with `usageStore`'s broader
 * multi-metric one; it only ever counted refines, so the name now says so.
 */

/** Current calendar month key, e.g. "2026-09" — resets usage automatically. */
function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface PlanState {
  plan: PlanId;
  /** Month the counter belongs to; usage resets when the month rolls over. */
  usageMonth: string;
  /** Refine/compare runs started this month (LOCAL/anonymous trial counter). */
  refinesUsed: number;

  /**
   * When signed in, the server (Postgres Entitlement/UsageCounter) is the
   * source of truth. These mirror it so the UI shows the enforceable numbers.
   */
  serverActive: boolean;
  serverUsed: number;

  setPlan: (p: PlanId) => void;
  /** Count one refine run against the LOCAL cap (a compare counts once). */
  recordRefine: () => void;
  /** Refines used this month — server truth when signed in, the local trial
   *  counter otherwise. Refine-specific; see the module comment above for why
   *  this doesn't just read from `usageStore`. */
  refineUsed: () => number;

  /** Adopt server-authoritative plan + usage (after authorize/readEntitlement). */
  syncFromServer: (v: { plan: PlanId; usedThisMonth: number }) => void;
  /** Drop server truth on sign-out and fall back to the free local default. */
  clearServer: () => void;
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      plan: "free",
      usageMonth: monthKey(),
      refinesUsed: 0,
      serverActive: false,
      serverUsed: 0,

      setPlan: (plan) => set({ plan }),
      recordRefine: () => {
        // The server owns the counter when signed in; only move the local
        // trial counter for anonymous users.
        if (get().serverActive) return;
        const now = monthKey();
        set((s) =>
          s.usageMonth === now
            ? { refinesUsed: s.refinesUsed + 1 }
            : { usageMonth: now, refinesUsed: 1 }
        );
      },
      refineUsed: () => {
        const s = get();
        if (s.serverActive) return s.serverUsed;
        return s.usageMonth === monthKey() ? s.refinesUsed : 0;
      },
      syncFromServer: ({ plan, usedThisMonth }) =>
        set({ plan, serverActive: true, serverUsed: usedThisMonth }),
      clearServer: () => set({ serverActive: false, serverUsed: 0, plan: "free" }),
    }),
    {
      // Anonymous default; StorageScope rebinds per signed-in user id so free-trial
      // counters never leak across accounts on a shared browser.
      name: "orire-plan:anon:v1",
      version: 1,
      // Never persist server-mirror fields — they're re-fetched on load.
      partialize: (s) => ({ plan: s.plan, usageMonth: s.usageMonth, refinesUsed: s.refinesUsed }),
    }
  )
);
