/**
 * orire — patch-mode refine reconstruction.
 *
 * The token-lean refine prompt (see prompt.ts) asks the model for ONLY the
 * tailorable content, referencing source experience/projects by index. This
 * module turns that compact patch back into a full candidate object shaped like
 * the CV schema, so the existing deterministic `factGround` pass can run over it
 * unchanged. Locked facts (identity, dates, companies, URLs, education, certs)
 * are carried straight from the source — the model never has to echo them.
 *
 * Robustness is deliberate: a malformed, empty, or partial patch must NEVER
 * blow away the CV. Missing sections fall back to the full source, and unknown
 * refs are skipped. This directly guards against the earlier failure where a
 * replace "cut out names and poorly arranged the details".
 */

import type { CVData } from "@/lib/cv/schema";

export interface RefinePatch {
  title?: string;
  summary?: string;
  order?: number[];
  experience?: PatchExpItem[];
  projects?: PatchPrjItem[];
  skills?: { category?: string; items?: string[] }[];
}
interface PatchExpItem {
  ref?: number;
  role?: string;
  highlights?: string[];
}
interface PatchPrjItem {
  ref?: number;
  role?: string;
  highlights?: string[];
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function asStrArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(asStr).map((s) => s.trim()).filter(Boolean) : [];
}
function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

/**
 * Reconstruct a full-shape candidate (as `factGround` expects) from the source
 * CV and a model patch. The return value is intentionally a loose record — it
 * is fed straight into `factGround`, which re-grounds and re-ids everything.
 */
export function applyRefinePatch(
  source: CVData,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const p = (patch ?? {}) as RefinePatch;

  // ----- basics: only title + summary are tailorable; the rest are locked. ---
  const basics = {
    title: asStr(p.title).trim() || source.basics.title,
    summary: asStr(p.summary).trim() || source.basics.summary,
  };

  // ----- experience: rebuild by ref, carrying locked facts from source. ------
  const pExp = Array.isArray(p.experience) ? p.experience : null;
  let experience: Record<string, unknown>[];
  if (pExp && pExp.length > 0) {
    experience = pExp
      .map((raw): Record<string, unknown> | null => {
        const e = (raw ?? {}) as PatchExpItem;
        if (!isInt(e.ref) || e.ref >= source.experience.length) return null;
        const src = source.experience[e.ref];
        const highlights = asStrArray(e.highlights);
        return {
          company: src.company,
          role: asStr(e.role).trim() || src.role,
          location: src.location ?? "",
          startDate: src.startDate ?? "",
          endDate: src.endDate ?? "",
          current: Boolean(src.current),
          highlights: highlights.length > 0 ? highlights : src.highlights,
        };
      })
      .filter((x): x is Record<string, unknown> => x !== null);
    // A patch that referenced nothing valid must not empty the CV.
    if (experience.length === 0) experience = source.experience.map(fullExp);
  } else {
    experience = source.experience.map(fullExp);
  }

  // Optional explicit reorder by source ref (applied only when it covers the
  // rebuilt set 1:1 to avoid dropping or duplicating entries).
  if (Array.isArray(p.order) && pExp && pExp.length > 0) {
    const wanted = p.order.filter(isInt);
    const bySrcRole = new Map<string, Record<string, unknown>>();
    pExp.forEach((e, i) => {
      if (isInt(e?.ref)) bySrcRole.set(`${e.ref}`, experience[i]);
    });
    const reordered = wanted
      .map((ref) => bySrcRole.get(`${ref}`))
      .filter((x): x is Record<string, unknown> => Boolean(x));
    if (reordered.length === experience.length) experience = reordered;
  }

  // ----- projects: same ref-based rebuild. -----------------------------------
  const pPrj = Array.isArray(p.projects) ? p.projects : null;
  let projects: Record<string, unknown>[];
  if (pPrj && pPrj.length > 0) {
    projects = pPrj
      .map((raw): Record<string, unknown> | null => {
        const pr = (raw ?? {}) as PatchPrjItem;
        if (!isInt(pr.ref) || pr.ref >= source.projects.length) return null;
        const src = source.projects[pr.ref];
        const highlights = asStrArray(pr.highlights);
        return {
          name: src.name,
          role: asStr(pr.role).trim() || src.role || "",
          url: src.url ?? "",
          startDate: src.startDate ?? "",
          endDate: src.endDate ?? "",
          highlights: highlights.length > 0 ? highlights : src.highlights,
        };
      })
      .filter((x): x is Record<string, unknown> => x !== null);
    if (projects.length === 0) projects = source.projects.map(fullPrj);
  } else {
    projects = source.projects.map(fullPrj);
  }

  // ----- skills: the model may regroup/reorder EXISTING skills; factGround
  //       filters out anything not in the source, so passing strings is safe.
  const pSkills = Array.isArray(p.skills) ? p.skills : null;
  const skills =
    pSkills && pSkills.length > 0
      ? pSkills.map((g) => ({
          category: asStr(g?.category).trim(),
          items: asStrArray(g?.items),
        }))
      : source.skills.map((g) => ({ category: g.category, items: g.items }));

  // ----- education + certifications: fully locked — carry from source. -------
  const education = source.education.map((e) => ({
    institution: e.institution,
    degree: e.degree,
    field: e.field ?? "",
    startDate: e.startDate ?? "",
    endDate: e.endDate ?? "",
    details: e.details ?? "",
  }));
  const certifications = source.certifications.map((c) => ({
    name: c.name,
    issuer: c.issuer ?? "",
    date: c.date ?? "",
    url: c.url ?? "",
  }));

  return { basics, experience, education, skills, projects, certifications };
}

function fullExp(e: CVData["experience"][number]): Record<string, unknown> {
  return {
    company: e.company,
    role: e.role,
    location: e.location ?? "",
    startDate: e.startDate ?? "",
    endDate: e.endDate ?? "",
    current: Boolean(e.current),
    highlights: e.highlights,
  };
}
function fullPrj(p: CVData["projects"][number]): Record<string, unknown> {
  return {
    name: p.name,
    role: p.role ?? "",
    url: p.url ?? "",
    startDate: p.startDate ?? "",
    endDate: p.endDate ?? "",
    highlights: p.highlights,
  };
}
