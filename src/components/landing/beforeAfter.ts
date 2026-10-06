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
    after: "Grew the brand's following 3× to 45k and lifted engagement 60% in 11 months.",
  },
  {
    before: "Helped the design team with various projects.",
    after: "Shipped 20+ product screens and cut design-to-dev handoff time by 40%.",
  },
  {
    before: "Worked on improving the checkout page.",
    after: "Redesigned checkout, raising conversion from 2.1% to 3.4% across 90k sessions.",
  },
  {
    before: "Did customer support and answered tickets.",
    after: "Resolved 1,200+ tickets at a 97% CSAT while trimming first-response time to 8 minutes.",
  },
];

/** The ordered before/after pairs for the landing proof block. */
export function beforeAfterLines(): BeforeAfterLine[] {
  return LINES.map((l) => ({ ...l }));
}
