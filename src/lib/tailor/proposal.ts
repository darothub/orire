/**
 * orire — Tailor proposals (ADR 0002, phase 2).
 *
 * Refine and Coach never write to the CV. Each produces a proposal: the CV it
 * was generated from (`base`), the candidate (`after`) and the source tool. A
 * proposal can be reviewed after the CV has moved on, because the diff is
 * re-based onto the live CV: a change still applies only if the live CV has not
 * touched the part it rewrites. Anything else is reported as skipped, never
 * applied.
 */

import type { CVData } from "@/lib/cv/schema";
import { applyReviewed, diffCv, type CvChange } from "@/lib/ai/cvDiff";

export type ProposalTool = "refine" | "coach";

export interface Proposal {
  id: string;
  tool: ProposalTool;
  base: CVData;
  after: CVData;
  createdAt: number;
}

/** Stable fingerprint of a CV, used to detect that the CV has moved on. */
export function cvHash(cv: CVData): string {
  const s = JSON.stringify(cv);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${s.length.toString(36)}-${h.toString(36)}`;
}

const trimmed = (lines: string[]) => lines.map((l) => l.trim()).filter(Boolean);

/** The text a change id covers, taken from any CV. Null when the id has no home. */
function sectionLines(cv: CVData, id: string): string[] | null {
  if (id === "title") return [cv.basics.title.trim()];
  if (id === "summary") return [cv.basics.summary.trim()];
  if (id === "skills") {
    return cv.skills
      .map((g) => `${g.category}: ${g.items.filter((i) => i.trim()).join(", ")}`)
      .filter((l) => l.replace(/:\s*$/, "").trim());
  }
  const [kind, raw] = id.split(":");
  const i = Number(raw);
  if (kind === "exp") return cv.experience[i] ? trimmed(cv.experience[i].highlights) : null;
  if (kind === "prj") return cv.projects[i] ? trimmed(cv.projects[i].highlights) : null;
  return null;
}

const same = (a: string[] | null, b: string[] | null) =>
  a !== null && b !== null && a.length === b.length && a.every((v, i) => v === b[i]);

export interface RebasedProposal {
  /** The CV has changed since the proposal was made. */
  stale: boolean;
  /** Changes relative to the live CV that are safe to offer. */
  changes: CvChange[];
  /** Changes dropped because the live CV edited the same part. */
  skipped: CvChange[];
}

/**
 * Re-base a proposal onto the live CV. A change is offered only if the
 * proposal really made it (it is in diff(base, after)) and the live CV still
 * holds the original text for that part. Parts the user edited are skipped, and
 * parts the proposal never touched are never offered, so a stale proposal can
 * not revert the user's own work.
 */
export function rebaseProposal(base: CVData, after: CVData, live: CVData): RebasedProposal {
  const stale = cvHash(base) !== cvHash(live);
  const proposed = diffCv(base, after);
  if (!stale) return { stale, changes: proposed, skipped: [] };

  const liveDiff = new Map(diffCv(live, after).map((c) => [c.id, c]));
  const changes: CvChange[] = [];
  const skipped: CvChange[] = [];
  for (const change of proposed) {
    const untouched = same(sectionLines(base, change.id), sectionLines(live, change.id));
    const offered = liveDiff.get(change.id);
    if (untouched && offered) changes.push(offered);
    else if (!untouched) skipped.push(change);
  }
  return { stale, changes, skipped };
}

/**
 * Apply the accepted, offered changes onto the live CV. Everything the user did
 * not explicitly accept, including parts only the live CV changed, is rejected
 * so applyReviewed can touch nothing else.
 */
export function applyOffered(live: CVData, after: CVData, offered: CvChange[], rejected: Iterable<string>): CVData {
  const declined = new Set(rejected);
  const accept = new Set(offered.map((c) => c.id).filter((id) => !declined.has(id)));
  const rejectAll = diffCv(live, after).map((c) => c.id).filter((id) => !accept.has(id));
  return applyReviewed(live, after, rejectAll);
}
