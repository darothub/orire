/**
 * orire — landing "How it works" steps.
 *
 * The three-step story visitors need before they trust the product: what they
 * bring, what Orire does, what they leave with. Kept as pure data (numbered,
 * ordered) so the section can be unit-tested in the node env with no DOM and so
 * the copy lives in one reviewable place.
 */

export interface HowStep {
  /** 1-based step number, shown as the ordinal marker. */
  n: number;
  icon: string;
  title: string;
  body: string;
}

const STEPS: Omit<HowStep, "n">[] = [
  {
    icon: "⇪",
    title: "Upload what you have",
    body: "Drop in your current CV — PDF or DOCX, even a rough one. Orire reads it into clean, structured sections. Nothing to retype.",
  },
  {
    icon: "⟳",
    title: "Re-brand & tailor",
    body: "Pick a standout template and, if you have a role in mind, paste the job description. Orire restructures and sharpens your wording to match — only ever from your real facts.",
  },
  {
    icon: "⇩",
    title: "Compare, score & export",
    body: "Run two assistants side by side, let the judge pick the strongest, watch the deterministic score climb, then export a clean, ATS-ready PDF.",
  },
];

/** Build the ordered, numbered steps for the "How it works" section. */
export function howItWorksSteps(): HowStep[] {
  return STEPS.map((step, i) => ({ n: i + 1, ...step }));
}
