/**
 * orire — CV change diff for the "review AI edits" flow (trust / transparency).
 *
 * A Refine produces a fully fact-grounded candidate CV: it keeps the same
 * companies, roles, projects and skills (nothing invented — see `factGround`)
 * and only *rephrases* the summary/title and the bullet highlights. Because the
 * patch applies by index (`ref`), before/after align positionally, so we can
 * present each rewrite as a precise before→after change the user can accept or
 * reject individually before anything touches their CV.
 */

import type { CVData } from "@/lib/cv/schema";

export type CvChangeKind = "title" | "summary" | "experience" | "project" | "skills";

export interface CvChange {
  /** Stable id: "title" | "summary" | "exp:<i>" | "prj:<i>" | "skills". */
  id: string;
  kind: CvChangeKind;
  /** Human label, e.g. "Experience — Senior Engineer, Acme". */
  label: string;
  /** Original lines (bullets, or a single-element array for text fields). */
  before: string[];
  /** Proposed lines. */
  after: string[];
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const normLines = (lines: string[]) => lines.map((l) => l.trim()).filter(Boolean);
const sameLines = (a: string[], b: string[]) => {
  const x = normLines(a);
  const y = normLines(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

function skillLines(cv: CVData): string[] {
  return cv.skills
    .map((g) => `${g.category}: ${g.items.filter((i) => i.trim()).join(", ")}`)
    .filter((l) => l.replace(/:\s*$/, "").trim());
}

/** Compute the reviewable changes between the user's CV and a refined candidate. */
export function diffCv(before: CVData, after: CVData): CvChange[] {
  const changes: CvChange[] = [];

  if (before.basics.title.trim() !== after.basics.title.trim()) {
    changes.push({ id: "title", kind: "title", label: "Headline", before: [before.basics.title], after: [after.basics.title] });
  }
  if (before.basics.summary.trim() !== after.basics.summary.trim()) {
    changes.push({ id: "summary", kind: "summary", label: "Summary", before: [before.basics.summary], after: [after.basics.summary] });
  }

  const nExp = Math.min(before.experience.length, after.experience.length);
  for (let i = 0; i < nExp; i++) {
    const b = before.experience[i];
    const a = after.experience[i];
    if (!sameLines(b.highlights, a.highlights)) {
      const label = `Experience — ${[a.role || b.role, a.company || b.company].filter(Boolean).join(", ")}`;
      changes.push({ id: `exp:${i}`, kind: "experience", label, before: b.highlights, after: a.highlights });
    }
  }

  const nPrj = Math.min(before.projects.length, after.projects.length);
  for (let i = 0; i < nPrj; i++) {
    const b = before.projects[i];
    const a = after.projects[i];
    if (!sameLines(b.highlights, a.highlights)) {
      const label = `Project — ${a.name || b.name}`;
      changes.push({ id: `prj:${i}`, kind: "project", label, before: b.highlights, after: a.highlights });
    }
  }

  const bSkills = skillLines(before);
  const aSkills = skillLines(after);
  if (!sameLines(bSkills, aSkills)) {
    changes.push({ id: "skills", kind: "skills", label: "Skills", before: bSkills, after: aSkills });
  }

  return changes;
}

/**
 * Build the reviewed result using SOURCE as the starting point, never the
 * untrusted AI candidate. This is a strict allowlist of fields presented in the
 * review UI. It prevents invisible changes to employment history, dates,
 * education, certifications, project URLs, ids or section order.
 *
 * A proposal whose source identity does not align at an index cannot have its
 * highlights applied to that index, regardless of what the user clicks.
 */
export function applyReviewed(before: CVData, after: CVData, rejected: Iterable<string>): CVData {
  const out = clone(before);
  const reject = new Set(rejected);
  const reviewable = new Set(diffCv(before, after).map((change) => change.id));
  const allowed = (id: string) => reviewable.has(id) && !reject.has(id);

  if (allowed("title")) out.basics.title = after.basics.title;
  if (allowed("summary")) out.basics.summary = after.basics.summary;
  if (allowed("skills")) out.skills = clone(after.skills);

  for (let i = 0; i < before.experience.length; i++) {
    const source = before.experience[i];
    const proposed = after.experience[i];
    if (!proposed || !allowed(`exp:${i}`)) continue;

    const sameJob = source.company === proposed.company &&
      source.role === proposed.role &&
      (source.startDate ?? "") === (proposed.startDate ?? "") &&
      (source.endDate ?? "") === (proposed.endDate ?? "") &&
      Boolean(source.current) === Boolean(proposed.current);
    if (sameJob) out.experience[i].highlights = clone(proposed.highlights);
  }

  for (let i = 0; i < before.projects.length; i++) {
    const source = before.projects[i];
    const proposed = after.projects[i];
    if (!proposed || !allowed(`prj:${i}`)) continue;
    const sameProject = source.name === proposed.name &&
      (source.role ?? "") === (proposed.role ?? "") &&
      (source.startDate ?? "") === (proposed.startDate ?? "") &&
      (source.endDate ?? "") === (proposed.endDate ?? "");
    if (sameProject) out.projects[i].highlights = clone(proposed.highlights);
  }
  return out;
}
