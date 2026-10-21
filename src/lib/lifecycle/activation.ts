/**
 * orire — activation-nudge gating (P1-12).
 *
 * Pure decision behind the 24–48h-after-signup activation email: which gap
 * (if any) is worth nudging a user about. Pulled out of the cron route so the
 * decision is unit-testable without a database.
 *
 * Scope, as agreed: track two activation signals — has the user ever
 * exported, and has the user ever run Simulate (the differentiator feature).
 * A single email goes out once, in the 24–48h window, tailored to whichever
 * gap(s) still exist; a user who's done both gets nothing.
 */

export type ActivationGap = "export" | "simulate" | "both";

/** Which gap (if any) the 24–48h nudge should cover for a user, given their
 *  lifetime "ever done this" signals. Returns null once both are done. */
export function pickActivationGap(state: { exported: boolean; simulated: boolean }): ActivationGap | null {
  if (!state.exported && !state.simulated) return "both";
  if (!state.exported) return "export";
  if (!state.simulated) return "simulate";
  return null;
}
