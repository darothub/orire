/**
 * Unique, human-readable copy for each template's gallery page. Kept separate
 * from the catalog so the public /templates pages lead with distinct text per
 * template (good for search, avoids duplicate-content), while names/blurbs stay
 * single-sourced in src/lib/templates/catalog.ts.
 */

export interface TemplateCopy {
  /** 1–2 sentences describing the look and feel. */
  summary: string;
  /** Short "who it suits" line. */
  bestFor: string;
}

const COPY: Record<string, TemplateCopy> = {
  aurora: { summary: "A bright, editorial one-column layout with a soft gradient spine down the side. Clean type and generous spacing keep the focus on your words.", bestFor: "Designers, product and marketing roles that value a modern, polished look." },
  noir: { summary: "A dark, luxe layout anchored by an oversized serif name. High contrast and restraint make it feel considered rather than loud.", bestFor: "Senior and creative roles where a confident, premium tone fits." },
  meridian: { summary: "Swiss-minimal structure with monospaced section labels and crisp rules. Everything is aligned to a tight grid.", bestFor: "Engineers and analysts who want precise, no-frills structure." },
  vertex: { summary: "A bold gradient sidebar carries your contact details and skills while the main column tells the story.", bestFor: "Candidates who want a striking, modern two-column CV." },
  slate: { summary: "A corporate single-column layout with a calm blue accent rail. Familiar and easy for recruiters to scan.", bestFor: "Business, finance and operations roles." },
  ivory: { summary: "A warm cream palette with a centered serif header. Classic and understated.", bestFor: "Traditional industries and academic applications." },
  carbon: { summary: "A dark, technical two-column layout with cyan accents and monospaced detail. Reads like a well-kept terminal.", bestFor: "Software, data and infrastructure engineers." },
  coral: { summary: "A soft peach two-column layout with a friendly, approachable feel.", bestFor: "People-facing roles — support, community, early-career." },
  onyx: { summary: "A near-black, uppercase-led single column with heavy structure and strong headings.", bestFor: "Bold applicants who want maximum contrast." },
  verde: { summary: "A deep-green two-column layout with gold serif accents for a grounded, premium tone.", bestFor: "Established professionals in traditional fields." },
  sapphire: { summary: "A royal-blue banner header over a clean single column. Confident and corporate.", bestFor: "Management and client-facing roles." },
  marigold: { summary: "An amber editorial layout with a big serif headline and warm accents.", bestFor: "Writers, editors and creative communicators." },
  frost: { summary: "An icy blue-gray two-column layout with a calm, spacious feel.", bestFor: "Healthcare, research and roles that value clarity." },
  crimson: { summary: "A bold red single column with condensed caps for an assertive first impression.", bestFor: "Sales, growth and roles where standing out helps." },
  nordic: { summary: "A muted, airy single column with lots of whitespace and quiet typography.", bestFor: "Design-minded candidates who prefer restraint." },
  mono: { summary: "A monochrome, typewriter-styled layout stripped to pure structure.", bestFor: "Developers and minimalists." },
  plum: { summary: "A purple modern two-column layout with a confident sidebar.", bestFor: "Creative and product roles wanting a distinctive palette." },
  sand: { summary: "A desert-neutral two-column layout with warm, earthy tones.", bestFor: "Candidates who want warmth without losing professionalism." },
  aqua: { summary: "A teal single column with rounded skill chips and a fresh, friendly feel.", bestFor: "Early-career and product/marketing applicants." },
  graphite: { summary: "A grayscale two-column layout lifted by a single orange accent.", bestFor: "Engineers and PMs who want understated contrast." },
  oxford: { summary: "A navy-and-bronze executive layout with a double-rule crest header.", bestFor: "Senior leadership and executive applications." },
  bordeaux: { summary: "An oxblood-wine two-column layout with a classic serif for a refined, traditional tone.", bestFor: "Law, finance and established professions." },
  sterling: { summary: "A charcoal-and-steel single column with tracked uppercase headings.", bestFor: "Executives who want sober, high-end structure." },
  imperial: { summary: "A black layout with a champagne-gold banner — formal and commanding.", bestFor: "C-suite and board-level applications." },
  consul: { summary: "A graphite layout with deep-teal serif accents, balancing authority and warmth.", bestFor: "Directors and senior specialists." },
};

export function getTemplateCopy(id: string): TemplateCopy | undefined {
  return COPY[id];
}
