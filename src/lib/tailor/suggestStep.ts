export type TailorStep = "job" | "simulate" | "coach" | "refine" | "export";

export interface TailorSignals {
  /** A real CV exists (not the blank or sample draft). */
  hasCv: boolean;
  /** The shared target job description. */
  jd: string;
  /** A simulated ideal is locked for the current job. */
  simulated: boolean;
  /** Job keywords the CV does not yet cover (deterministic match). */
  missingCount: number;
  /** The CV has been through Refine at least once. */
  refined: boolean;
}

export interface TailorSuggestion {
  step: TailorStep;
  reason: string;
}

/**
 * The single step the Tailor hub highlights. Ordered like the guided run:
 * job, then diagnose (Simulate), then elicit facts (Coach) while there are
 * gaps, then rewrite (Refine). Only signals that are really tracked are used.
 */
export function suggestTailorStep(s: TailorSignals): TailorSuggestion {
  if (!s.hasCv) return { step: "job", reason: "Add your CV first, then pick the job you want." };
  if (!s.jd.trim()) return { step: "job", reason: "Paste the job description. Every tool uses it." };
  if (!s.simulated) return { step: "simulate", reason: "See how close you are and where the gaps are." };
  if (s.missingCount > 0 && !s.refined) {
    return { step: "coach", reason: "Answer a few questions so real achievements fill the gaps." };
  }
  if (!s.refined) return { step: "refine", reason: "Tailor the wording to the job from facts already on your CV." };
  return { step: "export", reason: "Your CV has been tailored. Export it, or run Simulate again to re-check." };
}
