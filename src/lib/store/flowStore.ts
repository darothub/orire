"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WorkspaceView } from "@/lib/store/viewStore";

/**
 * The building-block workspace (A1–A3).
 *
 * The left rail is composed, not fixed: three pinned views stay constant
 * (Profile, Plan, AI Settings) and the rest are "blocks" the user arranges into
 * a sequence — their CV course. The order persists per-browser (localStorage);
 * multiple named/synced pipelines are a later Career feature.
 */

/** Always-present views, never part of the reorderable sequence. */
export const PINNED_VIEWS: WorkspaceView[] = ["profile", "plans", "connect"];

/** Views that can appear in (and be removed from) the sequence. */
export const COMPOSABLE_BLOCKS: WorkspaceView[] = [
  "rebrand",
  "edit",
  "refine",
  "target",
  "rate",
  "cover",
  "export",
  "history",
];

/** The guided default — the order a new user starts with (A2). */
export const RECOMMENDED_FLOW: WorkspaceView[] = [
  "rebrand",
  "edit",
  "refine",
  "target",
  "rate",
  "cover",
  "export",
  "history",
];

const COMPOSABLE_SET = new Set(COMPOSABLE_BLOCKS);

/** Keep a sequence valid: only known blocks, no duplicates. */
function sanitize(seq: WorkspaceView[]): WorkspaceView[] {
  const seen = new Set<WorkspaceView>();
  const out: WorkspaceView[] = [];
  for (const v of seq) {
    if (COMPOSABLE_SET.has(v) && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

interface FlowState {
  /** The ordered blocks shown in the rail. */
  sequence: WorkspaceView[];
  /** Whether the one-time drag/compose coach-mark has been dismissed (A2). */
  coachSeen: boolean;

  /** Add a block to the end of the sequence (no-op if already present). */
  addBlock: (v: WorkspaceView) => void;
  /** Remove a block from the sequence (it stays available in the spotlight). */
  removeBlock: (v: WorkspaceView) => void;
  /** Replace the whole order (used by drag-to-reorder in A2). */
  setSequence: (seq: WorkspaceView[]) => void;
  /** Restore the guided Recommended Flow. */
  resetFlow: () => void;
  /** True once a block is in the sequence. */
  inFlow: (v: WorkspaceView) => boolean;
  dismissCoach: () => void;
}

export const useFlowStore = create<FlowState>()(
  persist(
    (set, get) => ({
      sequence: [...RECOMMENDED_FLOW],
      coachSeen: false,

      addBlock: (v) =>
        set((s) => (COMPOSABLE_SET.has(v) && !s.sequence.includes(v) ? { sequence: [...s.sequence, v] } : s)),
      removeBlock: (v) => set((s) => ({ sequence: s.sequence.filter((x) => x !== v) })),
      setSequence: (seq) => set({ sequence: sanitize(seq) }),
      resetFlow: () => set({ sequence: [...RECOMMENDED_FLOW] }),
      inFlow: (v) => get().sequence.includes(v),
      dismissCoach: () => set({ coachSeen: true }),
    }),
    {
      // Anonymous default; StorageScope rebinds per signed-in user id.
      name: "orire-flow:anon:v1",
      version: 1,
      partialize: (s) => ({ sequence: s.sequence, coachSeen: s.coachSeen }),
      // Drop any stale/unknown blocks a persisted order might carry (e.g. after
      // a view is renamed or retired), falling back to the Recommended Flow.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<FlowState>;
        const seq = sanitize(Array.isArray(p.sequence) ? p.sequence : []);
        return {
          ...current,
          ...p,
          sequence: seq.length ? seq : [...RECOMMENDED_FLOW],
        };
      },
    },
  ),
);
