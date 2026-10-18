/**
 * orire — multi-CV merge (req 19).
 *
 * Combines several ParsedCVs (from multiple uploaded files) into a single,
 * de-duplicated CV. Fact-grounded: it only unions and fills values that already
 * exist across the sources — it never invents content. Conflicting single-value
 * basics (e.g. two different job titles) are surfaced so the user can choose
 * which to keep rather than silently dropping one.
 */

import type { ParsedCV } from "./parse";
import type { Link } from "@/lib/cv/schema";

export type BasicsField = "fullName" | "title" | "email" | "phone" | "location" | "summary";

export interface BasicsConflict {
  field: BasicsField;
  label: string;
  /** Distinct non-empty candidates, in source order. First is the default. */
  values: string[];
}

export interface MergeStats {
  files: number;
  experience: number;
  education: number;
  skills: number;
  projects: number;
  certifications: number;
  /** List items collapsed because they duplicated an earlier entry. */
  duplicatesRemoved: number;
}

export interface MergeResult {
  merged: ParsedCV;
  conflicts: BasicsConflict[];
  stats: MergeStats;
}

const FIELD_LABELS: Record<BasicsField, string> = {
  fullName: "Name",
  title: "Title",
  email: "Email",
  phone: "Phone",
  location: "Location",
  summary: "Summary",
};

const norm = (s: string | undefined): string =>
  (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Union of strings, de-duplicated by normalized value, keeping first-seen casing. */
function unionStrings(...lists: (string[] | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list ?? []) {
      const k = norm(raw);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(raw.trim());
    }
  }
  return out;
}

const pick = (a: string | undefined, b: string | undefined): string => (a && a.trim() ? a : b ?? "") || "";

function distinctNonEmpty(values: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = (v ?? "").trim();
    if (!t) continue;
    const k = norm(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export function mergeParsedCVs(sources: ParsedCV[]): MergeResult {
  const files = sources.length;
  let duplicatesRemoved = 0;

  // ── Basics: first non-empty wins; divergence becomes a conflict. ──────────
  const basicFields: BasicsField[] = ["fullName", "title", "email", "phone", "location", "summary"];
  const basics: Record<BasicsField, string> = {
    fullName: "", title: "", email: "", phone: "", location: "", summary: "",
  };
  const conflicts: BasicsConflict[] = [];
  for (const f of basicFields) {
    const candidates = distinctNonEmpty(sources.map((s) => s.basics[f] as string | undefined));
    basics[f] = candidates[0] ?? "";
    if (candidates.length > 1) conflicts.push({ field: f, label: FIELD_LABELS[f], values: candidates });
  }

  const links: Link[] = [];
  const linkSeen = new Set<string>();
  for (const s of sources) {
    for (const l of s.basics.links ?? []) {
      const k = norm(l.url) || norm(l.label);
      if (!k || linkSeen.has(k)) continue;
      linkSeen.add(k);
      links.push(l);
    }
  }

  // ── Lists: concatenate, then collapse duplicates by a stable key. ─────────
  const expMap = new Map<string, ParsedCV["experience"][number]>();
  for (const s of sources) {
    for (const e of s.experience) {
      const key = `${norm(e.company)}|${norm(e.role)}`;
      const prev = expMap.get(key);
      if (prev) {
        duplicatesRemoved++;
        expMap.set(key, {
          ...prev,
          company: pick(prev.company, e.company),
          role: pick(prev.role, e.role),
          location: pick(prev.location, e.location),
          startDate: pick(prev.startDate, e.startDate),
          endDate: pick(prev.endDate, e.endDate),
          current: prev.current || e.current,
          highlights: unionStrings(prev.highlights, e.highlights),
        });
      } else {
        expMap.set(key, { ...e });
      }
    }
  }

  const eduMap = new Map<string, ParsedCV["education"][number]>();
  for (const s of sources) {
    for (const e of s.education) {
      const key = `${norm(e.institution)}|${norm(e.degree)}`;
      const prev = eduMap.get(key);
      if (prev) {
        duplicatesRemoved++;
        eduMap.set(key, {
          ...prev,
          institution: pick(prev.institution, e.institution),
          degree: pick(prev.degree, e.degree),
          field: pick(prev.field, e.field),
          startDate: pick(prev.startDate, e.startDate),
          endDate: pick(prev.endDate, e.endDate),
          details: pick(prev.details, e.details),
        });
      } else {
        eduMap.set(key, { ...e });
      }
    }
  }

  const prjMap = new Map<string, ParsedCV["projects"][number]>();
  for (const s of sources) {
    for (const p of s.projects) {
      const key = norm(p.name);
      const prev = prjMap.get(key);
      if (prev) {
        duplicatesRemoved++;
        prjMap.set(key, {
          ...prev,
          name: pick(prev.name, p.name),
          role: pick(prev.role, p.role),
          url: pick(prev.url, p.url),
          startDate: pick(prev.startDate, p.startDate),
          endDate: pick(prev.endDate, p.endDate),
          highlights: unionStrings(prev.highlights, p.highlights),
        });
      } else {
        prjMap.set(key, { ...p });
      }
    }
  }

  const certMap = new Map<string, ParsedCV["certifications"][number]>();
  for (const s of sources) {
    for (const c of s.certifications) {
      const key = `${norm(c.name)}|${norm(c.issuer)}`;
      const prev = certMap.get(key);
      if (prev) {
        duplicatesRemoved++;
        certMap.set(key, {
          ...prev,
          name: pick(prev.name, c.name),
          issuer: pick(prev.issuer, c.issuer),
          date: pick(prev.date, c.date),
          url: pick(prev.url, c.url),
        });
      } else {
        certMap.set(key, { ...c });
      }
    }
  }

  // ── Skills: merge groups by category, union items. ────────────────────────
  const sklMap = new Map<string, ParsedCV["skills"][number]>();
  for (const s of sources) {
    for (const g of s.skills) {
      const key = norm(g.category) || "skills";
      const prev = sklMap.get(key);
      if (prev) {
        const before = prev.items.length;
        const items = unionStrings(prev.items, g.items);
        if (items.length < before + g.items.length) duplicatesRemoved += before + g.items.length - items.length;
        sklMap.set(key, { ...prev, category: pick(prev.category, g.category), items });
      } else {
        sklMap.set(key, { ...g, items: unionStrings(g.items) });
      }
    }
  }

  const experience = [...expMap.values()];
  const education = [...eduMap.values()];
  const projects = [...prjMap.values()];
  const certifications = [...certMap.values()];
  const skills = [...sklMap.values()];

  const merged: ParsedCV = {
    basics: { ...basics, links },
    experience,
    education,
    skills,
    projects,
    certifications,
    // Carry forward each source's confidence notes (de-duplicated) — merging
    // doesn't fix a missing date or an unclear institution, so the "check
    // this" review step should still see them on the combined result.
    notes: [
      `Merged ${files} CV${files === 1 ? "" : "s"} into one.`,
      ...unionStrings(...sources.map((s) => s.notes)),
    ],
  };

  return {
    merged,
    conflicts,
    stats: {
      files,
      experience: experience.length,
      education: education.length,
      skills: skills.reduce((a, g) => a + g.items.length, 0),
      projects: projects.length,
      certifications: certifications.length,
      duplicatesRemoved,
    },
  };
}
