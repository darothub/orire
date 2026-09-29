/**
 * orire — deterministic JD-match scoring.
 *
 * Given a refined CV and the target job description, we measure — WITHOUT calling
 * a model — how well the CV covers the keywords the job asks for. This gives the
 * single Refine pass a concrete "match" signal (score + which JD keywords are
 * present vs. missing) that previously only existed in the 2-provider judge or
 * the separate Simulate flow.
 *
 * It is intentionally simple and transparent: extract meaningful terms from the
 * JD, then check which appear in the CV's text.
 */

import type { CVData } from "@/lib/cv/schema";

const STOPWORDS = new Set([
  "the","and","for","with","you","your","our","are","will","have","has","this","that",
  "from","who","all","any","can","not","but","was","were","been","being","its","their",
  "they","them","then","than","into","out","over","under","about","across","per","via",
  "a","an","of","to","in","on","at","as","is","it","or","by","be","we","us","i",
  "job","role","team","teams","work","working","working","experience","years","year",
  "ability","strong","good","great","excellent","including","etc","using","use","used",
  "such","help","new","other","must","should","would","could","may","also","well",
  "looking","seeking","join","candidate","candidates","ideal","plus","preferred",
  "required","requirements","responsibilities","qualifications","skills","skill",
  "knowledge","understanding","familiar","familiarity","proficient","proficiency",
  "environment","company","business","product","products","customer","customers",
  "day","days","time","full","part","within","across","most","more","less","best",
  "high","level","levels","related","field","degree","equivalent","proven","track",
  "record","ensure","support","deliver","build","building","develop","developing",
  "design","designing","manage","managing","drive","driving","lead","leading",
  "collaborate","collaboration","communication","communicate","stakeholders",
  "responsible","primarily","across","various","multiple","end","closely",
  "need","needs","want","wants","looking","seeking","join","apply","hire",
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((w) => w.replace(/^[.]+|[.]+$/g, ""))
    .filter(Boolean);
}

function isMeaningful(w: string): boolean {
  if (w.length < 2) return false;
  if (STOPWORDS.has(w)) return false;
  if (/^\d+$/.test(w)) return false;
  return true;
}

export interface JDMatch {
  /** 0–100: share of distinct JD keywords found in the CV. */
  score: number;
  matched: string[];
  missing: string[];
}

/**
 * Extract ranked keywords from the job description: meaningful unigrams ranked
 * by frequency, plus recurring bigrams (both tokens meaningful, appearing more
 * than once) as extra multi-word signals. Returns up to `limit` terms.
 */
export function extractKeywords(jd: string, limit = 28): string[] {
  const toks = words(jd);
  const uni = new Map<string, number>();
  const bi = new Map<string, number>();

  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];
    if (w && isMeaningful(w)) uni.set(w, (uni.get(w) ?? 0) + 1);
    const next = toks[i + 1];
    if (w && next && isMeaningful(w) && isMeaningful(next)) {
      const bg = `${w} ${next}`;
      bi.set(bg, (bi.get(bg) ?? 0) + 1);
    }
  }

  const unigrams = [...uni.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .map(([t]) => t);

  // Only keep bigrams that recur — one-off word pairs are usually noise.
  const bigrams = [...bi.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .map(([t]) => t);

  return [...unigrams, ...bigrams].slice(0, limit);
}

/** Flatten every piece of CV text into one lowercase haystack. */
export function cvText(cv: CVData): string {
  const parts: (string | undefined)[] = [
    cv.basics.title,
    cv.basics.summary,
    ...cv.experience.flatMap((e) => [e.company, e.role, e.location, ...e.highlights]),
    ...cv.education.flatMap((e) => [e.institution, e.degree, e.field, e.details]),
    ...cv.skills.flatMap((g) => [g.category, ...g.items]),
    ...cv.projects.flatMap((p) => [p.name, p.role, ...p.highlights]),
    ...cv.certifications.flatMap((c) => [c.name, c.issuer]),
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

/** Deterministically score how well a CV covers a job description's keywords. */
export function jdMatch(cv: CVData, jobDescription: string): JDMatch {
  const keywords = extractKeywords(jobDescription);
  if (keywords.length === 0) return { score: 0, matched: [], missing: [] };

  const hay = cvText(cv);
  const hayTokens = new Set(words(hay));
  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of keywords) {
    const present = kw.includes(" ")
      ? hay.includes(kw)
      : hayTokens.has(kw) || hay.includes(kw);
    (present ? matched : missing).push(kw);
  }

  const score = Math.round((matched.length / keywords.length) * 100);
  return { score, matched, missing };
}
