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
  /** Refine/compare runs started this month. */
  refinesUsed: number;

  setPlan: (p: PlanId) => void;
  /** Count one refine run against the monthly cap (a compare counts once). */
  recordRefine: () => void;
  /** Live count for the current month (0 after a rollover). */
  usedThisMonth: () => number;
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      plan: "free",
      usageMonth: monthKey(),
      refinesUsed: 0,

      setPlan: (plan) => set({ plan }),
      recordRefine: () => {
        const now = monthKey();
        set((s) =>
          s.usageMonth === now
            ? { refinesUsed: s.refinesUsed + 1 }
            : { usageMonth: now, refinesUsed: 1 }
        );
      },
      usedThisMonth: () => {
        const s = get();
        return s.usageMonth === monthKey() ? s.refinesUsed : 0;
      },
    }),
    { name: "orire-plan-v1", version: 1 }
  )
);
