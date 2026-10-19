/**
 * Estimated progress for the Simulate request.
 *
 * The provider call is a single non-streaming request, so there is no real
 * percentage to read. We show an honest estimate instead: stages advance with
 * elapsed time on an easing curve that approaches — but never reaches — 100%.
 * The caller reaches 100% only when the response has actually arrived.
 */

export const SIMULATE_STAGES = [
  { upTo: 12, label: "Reading the job description…" },
  { upTo: 30, label: "Extracting required skills and requirements…" },
  { upTo: 55, label: "Designing the ideal candidate profile…" },
  { upTo: 78, label: "Writing the ideal CV…" },
  { upTo: 101, label: "Checking and polishing the result…" },
] as const;

const CAP = 94;
const TIME_CONSTANT_MS = 10_000;
const SLOW_AFTER_MS = 30_000;

export interface SimulateProgress {
  percent: number;
  label: string;
  /** True once the request has taken unusually long. */
  slow: boolean;
}

export function simulateProgressAt(elapsedMs: number): SimulateProgress {
  const t = Math.max(0, elapsedMs);
  const percent = Math.min(CAP, Math.round(CAP * (1 - Math.exp(-t / TIME_CONSTANT_MS))));
  const stage = SIMULATE_STAGES.find((s) => percent < s.upTo) ?? SIMULATE_STAGES[SIMULATE_STAGES.length - 1];
  return { percent, label: stage.label, slow: t >= SLOW_AFTER_MS };
}
