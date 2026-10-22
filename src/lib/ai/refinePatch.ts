/**
 * orire — safe reconstruction of a model's optional CV wording patch.
 *
 * The model is NOT allowed to add/remove/reorder experience or projects. Its
 * references select ONLY which highlight text it proposes to rewrite; every
 * existing entry, locked fact and source order is carried forward untouched.
 * Applying a partial, duplicate or malformed patch must never silently delete
 * a user's career history or attach a bullet to a different employer.
 *
 * The resulting candidate still goes through factGround() and, crucially,
 * explicit per-change human review. Automated checks cannot prove every
 * sentence factually accurate.
 */
import type { CVData } from "@/lib/cv/schema";

export interface RefinePatch {
  title?: string;
  summary?: string;
  /** Older model responses may contain order; silently ignore it for safety. */
  order?: number[];
  experience?: PatchExpItem[];
  projects?: PatchPrjItem[];
  skills?: { category?: string; items?: string[] }[];
}
interface PatchExpItem { ref?: number; role?: string; highlights?: string[] }
interface PatchPrjItem { ref?: number; role?: string; highlights?: string[] }

function asStr(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function asStrArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean)
    : [];
}
function validRef(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < max;
}

/**
 * Only the first valid entry for a given source ref is considered. Extra,
 * duplicated, negative or out-of-range refs never become source entries.
 * A missing ref simply preserves its corresponding original item.
 */
function bySourceRef<T extends { ref?: number }>(items: unknown, length: number): Map<number, T> {
  const mapped = new Map<number, T>();
  if (!Array.isArray(items)) return mapped;
  for (const raw of items) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const entry = raw as T;
    if (validRef(entry.ref, length) && !mapped.has(entry.ref)) mapped.set(entry.ref, entry);
  }
  return mapped;
}

/** Turn a compact model patch into a full candidate without data loss. */
export function applyRefinePatch(
  source: CVData,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const p = (patch ?? {}) as RefinePatch;
  const expPatches = bySourceRef<PatchExpItem>(p.experience, source.experience.length);
  const projectPatches = bySourceRef<PatchPrjItem>(p.projects, source.projects.length);

  // The only tailorable basics are the professional headline and summary.
  const basics = {
    title: asStr(p.title).trim() || source.basics.title,
    summary: asStr(p.summary).trim() || source.basics.summary,
  };

  // Iterate the SOURCE order, never the untrusted patch order. Keep all rows,
  // including rows the model forgot to reference. Source roles are job facts:
  // never accept model-proposed role/title upgrades.
  const experience = source.experience.map((src, ref) => {
    const highlights = asStrArray(expPatches.get(ref)?.highlights);
    return {
      company: src.company,
      role: src.role,
      location: src.location ?? "",
      startDate: src.startDate ?? "",
      endDate: src.endDate ?? "",
      current: Boolean(src.current),
      highlights: highlights.length ? highlights : [...src.highlights],
    };
  });

  const projects = source.projects.map((src, ref) => {
    const highlights = asStrArray(projectPatches.get(ref)?.highlights);
    return {
      name: src.name,
      role: src.role ?? "",
      url: src.url ?? "",
      startDate: src.startDate ?? "",
      endDate: src.endDate ?? "",
      highlights: highlights.length ? highlights : [...src.highlights],
    };
  });

  // Skills can be regrouped or removed only after visible per-change review.
  // factGround() removes unmatched new skills before any user can apply them.
  const skillPatches = Array.isArray(p.skills) ? p.skills : null;
  const skills = skillPatches && skillPatches.length
    ? skillPatches.map((group) => ({
        category: asStr(group?.category).trim(),
        items: asStrArray(group?.items),
      }))
    : source.skills.map((group) => ({
        category: group.category,
        items: [...group.items],
      }));

  // Identity, education and certifications are never tailorable by this AI.
  const education = source.education.map((entry) => ({
    institution: entry.institution,
    degree: entry.degree,
    field: entry.field ?? "",
    startDate: entry.startDate ?? "",
    endDate: entry.endDate ?? "",
    details: entry.details ?? "",
  }));
  const certifications = source.certifications.map((entry) => ({
    name: entry.name,
    issuer: entry.issuer ?? "",
    date: entry.date ?? "",
    url: entry.url ?? "",
  }));

  return { basics, experience, projects, skills, education, certifications };
}
