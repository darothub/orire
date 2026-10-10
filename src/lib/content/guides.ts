/**
 * CV-advice guides for organic search. SCAFFOLD ONLY: each guide has a title,
 * meta description and a set of section headings with a one-line outline note.
 * The prose is intentionally left for a human to write — the outline marks what
 * each section should cover. Fill `body` paragraphs under each heading when
 * ready (or swap this shape for MDX).
 */

export interface GuideSection {
  heading: string;
  /** One-line note on what this section should say. Not published prose. */
  outline: string;
}

export interface Guide {
  slug: string;
  title: string;
  description: string;
  /** One-line summary shown on the index. */
  summary: string;
  sections: GuideSection[];
}

export const GUIDES: Guide[] = [
  {
    slug: "tailor-cv-to-job-description",
    title: "How to tailor your CV to a job description",
    description:
      "A practical method for matching your CV to a specific job description without inventing experience — mirror the language, re-order for relevance, and quantify.",
    summary: "Match a specific role without padding or inventing experience.",
    sections: [
      { heading: "Read the job description like a checklist", outline: "Pull out must-have skills, tools and responsibilities; group into themes." },
      { heading: "Mirror the employer's language", outline: "Use the same terms for skills/tools so human and ATS scanners match you." },
      { heading: "Re-order for relevance", outline: "Move the most relevant experience and bullets to the top; demote the rest." },
      { heading: "Quantify what you actually did", outline: "Turn duties into outcomes with real numbers — never fabricate figures." },
      { heading: "Keep it honest", outline: "Re-frame real experience; don't claim skills you don't have." },
    ],
  },
  {
    slug: "quantify-achievements-on-your-cv",
    title: "How to quantify achievements on your CV",
    description:
      "Turn flat job duties into outcome-led bullets with real numbers — a simple before/after method for making impact obvious to recruiters.",
    summary: "Turn duties into measurable, outcome-led bullets.",
    sections: [
      { heading: "Why numbers beat duties", outline: "Recruiters skim; a figure stops the eye and proves impact." },
      { heading: "The before → after pattern", outline: "Show a flat duty rewritten as a quantified outcome." },
      { heading: "Where to find your numbers", outline: "Scale, time saved, revenue, users, percentages, frequency." },
      { heading: "When you don't have hard metrics", outline: "Use scope, cadence and qualitative outcomes honestly." },
    ],
  },
  {
    slug: "beat-applicant-tracking-systems-ats",
    title: "How to get your CV past an ATS",
    description:
      "What applicant tracking systems actually parse, and how to format a CV so it's read correctly — without resorting to keyword stuffing.",
    summary: "Format so automated scanners read your CV correctly.",
    sections: [
      { heading: "What an ATS actually does", outline: "Parses text into fields; ranks on relevance — myth-bust the 'beat the bot' framing." },
      { heading: "Formatting that parses cleanly", outline: "Standard sections, real text (not images), simple structure." },
      { heading: "Keywords without stuffing", outline: "Use role-relevant terms naturally; avoid invisible-text tricks." },
      { heading: "Export settings that matter", outline: "Text-based PDF, selectable text, sensible file name." },
    ],
  },
  {
    slug: "choose-the-right-cv-template",
    title: "How to choose the right CV template",
    description:
      "How layout, density and tone should follow your industry and seniority — and how to pick from Orire's templates with confidence.",
    summary: "Match layout and tone to your industry and seniority.",
    sections: [
      { heading: "Match the template to the industry", outline: "Conservative fields vs. creative fields; when minimal wins." },
      { heading: "One column or two?", outline: "Trade-offs for ATS, density and scannability." },
      { heading: "Density vs. whitespace", outline: "How much experience you have should drive the layout." },
      { heading: "Pick from Orire's templates", outline: "Point to /templates; note all are ATS-ready and exportable." },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
