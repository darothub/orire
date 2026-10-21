import type { WorkspaceView } from "@/lib/store/viewStore";

/**
 * Pure decision behind the Spotlight grid's "recommended next" badge (P1-9 /
 * critique §3: "highlight the recommended next step for new users"). Pulled
 * out of the component so the gating order is unit-testable without
 * rendering React or standing up every store it reads from.
 *
 * Deliberately conservative — only the three steps below have a real,
 * already-tracked completion signal; there is no fabricated progress
 * tracking for Edit, Rate, Cover or History, so they never appear here.
 * `target` (Simulate) is excluded too: it already has its own always-visible
 * hero above the grid.
 */
export function recommendedNextBlock(state: {
  /** `cvStore.started` — flips once a real CV replaces the sample/blank one. */
  started: boolean;
  /** `cvStore.baseline !== null` — captured the first time refine is applied. */
  refined: boolean;
  /** Any library version has `lastExportedAt` set. */
  exported: boolean;
}): WorkspaceView | null {
  if (!state.started) return "rebrand";
  if (!state.refined) return "refine";
  if (!state.exported) return "export";
  return null;
}
