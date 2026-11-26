import { progressAt, type Progress, type ProgressProfile } from "./progress";

/** Estimated progress for the Simulate request (see ./progress). */
export const SIMULATE_STAGES = [
  { upTo: 12, label: "Reading the job description…" },
  { upTo: 30, label: "Extracting required skills and requirements…" },
  { upTo: 55, label: "Designing the ideal candidate profile…" },
  { upTo: 78, label: "Writing the ideal CV…" },
  { upTo: 101, label: "Checking and polishing the result…" },
] as const;

export const SIMULATE_PROFILE: ProgressProfile = { stages: SIMULATE_STAGES, cap: 94, timeConstantMs: 10_000, slowAfterMs: 30_000 };

export type SimulateProgress = Progress;

export function simulateProgressAt(elapsedMs: number): SimulateProgress {
  return progressAt(SIMULATE_PROFILE, elapsedMs);
}
