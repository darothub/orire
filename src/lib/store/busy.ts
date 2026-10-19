/**
 * Per-workspace busy flags for the rail. Refine and Simulate are independent:
 * a run in one must never mark the other as busy.
 */
export interface BusyInput {
  /** runStore.active keys currently in flight. */
  active: Record<string, unknown>;
  judgePhase: string;
  /** Refine column phases for the providers the user chose to run. */
  refineColPhases: string[];
}

export function workspaceBusy({ active, judgePhase, refineColPhases }: BusyInput) {
  return {
    refine:
      judgePhase === "running" ||
      Boolean(active["judge"]) ||
      refineColPhases.some((p) => p === "running"),
    simulate: Boolean(active["simulate"]) || Boolean(active["retone"]),
  };
}
