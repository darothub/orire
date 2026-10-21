/**
 * orire — landing "before / after" proof block.
 *
 * Concrete line-level transformations that show what re-branding actually does
 * to a bullet: a flat, passive duty on the left becomes a sharp, quantified
 * achievement on the right. Kept as pure data so the exact copy lives in one
 * reviewable place and can be unit-tested in the node env with no DOM.
 */

export interface BeforeAfterLine {
  /** The dull "as uploaded" phrasing. */
  before: string;
  /** The re-branded, outcome-led phrasing (same facts, sharpened). */
  after: string;
}

const LINES: BeforeAfterLine[] = [
  {
    before: "Responsible for managing the company's social media.",
    after: "Planned and published social media content, reviewed engagement trends, and coordinated campaign updates.",
  },
  {
    before: "Helped the design team with various projects.",
    after: "Collaborated with product designers on interface layouts and prepared design handoffs for development.",
  },
  {
    before: "Worked on improving the checkout page.",
    after: "Reviewed the checkout journey, identified friction points, and implemented usability improvements.",
  },
  {
    before: "Did customer support and answered tickets.",
    after: "Resolved customer support requests, documented recurring issues, and collaborated on service improvements.",
  },
];

/** The ordered before/after pairs for the landing proof block. */
export function beforeAfterLines(): BeforeAfterLine[] {
  return LINES.map((l) => ({ ...l }));
}
