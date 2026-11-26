import type { ProgressProfile } from "@/lib/ai/progress";
import { SIMULATE_PROFILE } from "@/lib/ai/simulateProgress";

/** What each long-running v4 action says while it works, and roughly how long it takes. */
export const PROGRESS = {
  simulate: SIMULATE_PROFILE,
  refine: {
    stages: [
      { upTo: 15, label: "Reading the job description…" },
      { upTo: 35, label: "Matching it to your experience…" },
      { upTo: 70, label: "Rewriting your summary and bullets…" },
      { upTo: 101, label: "Checking every change against your CV…" },
    ],
    cap: 94, timeConstantMs: 9_000, slowAfterMs: 30_000,
  },
  retone: {
    stages: [
      { upTo: 30, label: "Reading the tone of the job description…" },
      { upTo: 75, label: "Rewriting your bullets in that voice…" },
      { upTo: 101, label: "Checking that your facts stay the same…" },
    ],
    cap: 94, timeConstantMs: 6_000, slowAfterMs: 20_000,
  },
  question: {
    stages: [
      { upTo: 40, label: "Reading the role…" },
      { upTo: 101, label: "Choosing your next question…" },
    ],
    cap: 94, timeConstantMs: 3_500, slowAfterMs: 15_000,
  },
  feedback: {
    stages: [
      { upTo: 35, label: "Reading your answer…" },
      { upTo: 75, label: "Writing your feedback…" },
      { upTo: 101, label: "Checking the wording against what you said…" },
    ],
    cap: 94, timeConstantMs: 4_500, slowAfterMs: 20_000,
  },
} as const satisfies Record<string, ProgressProfile>;

export type ProgressKey = keyof typeof PROGRESS;
