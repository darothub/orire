/**
 * orire — client-side loop control for the CV coach. The server enforces the
 * round cap; this decides whether a new draft is actually better, so the loop
 * stops at a plateau and never replaces a good draft with a worse one.
 */

export interface DraftQuality {
  /** Guardrail warnings (invented figures, entities, stripped skills). */
  warnings: number;
  /** Deterministic ATS keyword coverage, 0–100. */
  atsScore: number;
}

/** Fewer unsupported details always wins; ATS coverage breaks ties. */
export function isBetterDraft(prev: DraftQuality, next: DraftQuality): boolean {
  if (next.warnings !== prev.warnings) return next.warnings < prev.warnings;
  return next.atsScore > prev.atsScore;
}
