"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PlanId } from "@/lib/plan/plan";

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
  /** Live count for the current month — server truth when signed in. */
  usedThisMonth: () => number;

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
      usedThisMonth: () => {
        const s = get();
        if (s.serverActive) return s.serverUsed;
        return s.usageMonth === monthKey() ? s.refinesUsed : 0;
      },
      syncFromServer: ({ plan, usedThisMonth }) =>
        set({ plan, serverActive: true, serverUsed: usedThisMonth }),
      clearServer: () => set({ serverActive: false, serverUsed: 0, plan: "free" }),
    }),
    {
      name: "orire-plan-v1",
      version: 1,
      // Never persist server-mirror fields — they're re-fetched on load.
      partialize: (s) => ({ plan: s.plan, usageMonth: s.usageMonth, refinesUsed: s.refinesUsed }),
    }
  )
);
