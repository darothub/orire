"use client";

import { create } from "zustand";
import { readUsage } from "@/app/actions/usage";
import type { UsageSummary } from "@/lib/entitlement/entitlement";
import type { Metric } from "@/lib/plan/plan";

/**
 * Ambient mirror of the signed-in user's per-metric usage (server-authoritative
 * via readUsage). Drives feature grey-out (point 10) and any "how many left"
 * reads. `summary` is null when signed out or not yet loaded.
 *
 * This only reflects server truth — it never decides enforcement, which lives
 * in the authorize action and AI routes. So a stale mirror can at worst show a
 * feature as available for a moment; the server still blocks the action.
 */
interface UsageState {
  summary: UsageSummary | null;
  setSummary: (s: UsageSummary | null) => void;
  /** Re-read usage from the server (after an action, or on auth). */
  refresh: () => Promise<void>;
  /** True when the metric is capped for this plan and nothing remains. */
  exhausted: (m: Metric) => boolean;
  /** Units left for a metric; null when unlimited or unknown. */
  remaining: (m: Metric) => number | null;
}

export const useUsageStore = create<UsageState>((set, get) => ({
  summary: null,
  setSummary: (summary) => set({ summary }),
  refresh: async () => {
    const summary = await readUsage();
    set({ summary });
  },
  exhausted: (metric) => {
    const u = get().summary?.metrics[metric];
    return !!u && u.cap !== null && (u.remaining ?? 0) <= 0;
  },
  remaining: (metric) => get().summary?.metrics[metric]?.remaining ?? null,
}));
