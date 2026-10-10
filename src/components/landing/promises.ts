/**
 * orire — landing "what to expect" statements.
 *
 * These are the product's own promises, in Orire's voice — NOT customer
 * testimonials. Orire has no verified reviews yet, so the landing page must not
 * present attributed quotes from named people (that would be fabricated social
 * proof). Each item describes a real, shipped capability. Replace this section
 * with genuine, attributable testimonials once they exist.
 *
 * Kept as pure data so the copy is reviewable in one place and testable in the
 * node env with no DOM.
 */

export interface Promise {
  /** Short label for the card. */
  title: string;
  /** One or two sentences describing a real capability. */
  body: string;
}

const ITEMS: Promise[] = [
  {
    title: "Your facts, elevated",
    body:
      "Upload the CV you already have and Orire re-lays it into a clean, modern template. It re-frames what you did — it never invents experience you don't have.",
  },
  {
    title: "Tailored to the role",
    body:
      "Paste a job description and Orire sharpens the wording and ordering to match it, drawing only on what is already in your CV.",
  },
  {
    title: "See which draft is stronger",
    body:
      "Run two assistants side by side and let the judge pick the strongest result, with its reasoning shown — so you are never guessing.",
  },
  {
    title: "A score you can trust",
    body:
      "The fidelity score is computed by a fixed rubric with no model call, so the same CV always earns the same score and you can watch real progress.",
  },
];

/** Return a fresh copy of the promises each call (no shared mutation). */
export function promises(): Promise[] {
  return ITEMS.map((p) => ({ ...p }));
}
