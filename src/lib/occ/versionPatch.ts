import type { CVData } from "@/lib/cv/schema";

export type CvField =
  | { kind: "summary" }
  | { kind: "experience"; itemId: string; index: number }
  | { kind: "project"; itemId: string; index: number };

export function readCvField(cv: CVData, field: CvField): string | null {
  if (field.kind === "summary") return cv.basics.summary;
  if (!field.itemId || !Number.isSafeInteger(field.index) || field.index < 0) return null;
  const collection = field.kind === "experience" ? cv.experience : cv.projects;
  const entry = collection.find(item => item.id === field.itemId);
  return entry?.highlights[field.index] ?? null;
}

/** Write a value into one CV field (summary / experience or project bullet),
 * returning a new CV. The single place the field mutation lives. */
function setCvFieldValue(cv: CVData, field: CvField, value: string): CVData {
  if (field.kind === "summary") {
    return { ...cv, basics: { ...cv.basics, summary: value } };
  }
  if (field.kind === "experience") {
    return { ...cv, experience: cv.experience.map(item =>
      item.id !== field.itemId ? item : {
        ...item, highlights: item.highlights.map((v, index) => index === field.index ? value : v),
      },
    ) };
  }
  return { ...cv, projects: cv.projects.map(item =>
    item.id !== field.itemId ? item : {
      ...item, highlights: item.highlights.map((v, index) => index === field.index ? value : v),
    },
  ) };
}

/** Approve a safe rewrite: guarded (must match `expected`, differ, and be a
 * substantial 10–1500 chars). Used by the review Apply flow. */
export function patchCvField(cv: CVData, field: CvField, expected: string, replacement: string): CVData | null {
  if (typeof expected !== "string" || typeof replacement !== "string" ||
      replacement.trim().length < 10 || replacement.length > 1500 ||
      readCvField(cv, field) !== expected || replacement.trim() === expected) return null;
  return setCvFieldValue(cv, field, replacement.trim());
}

/** Free inline edit: looser than patchCvField — any non-empty text up to 2000
 * chars, as long as the field exists. Used by the preview's edit mode. */
export function writeCvField(cv: CVData, field: CvField, text: string): CVData | null {
  const value = text.trim();
  if (!value || value.length > 2000 || readCvField(cv, field) === null) return null;
  return setCvFieldValue(cv, field, value);
}

export type CvFieldChoice = { label: string; field: CvField; text: string };

/** The revisable fields of a CV — its summary and every non-empty experience
 * and project bullet — as a flat, selectable list. Shared across OCC surfaces
 * so the field taxonomy is declared once. */
export function cvFieldChoices(cv: CVData): CvFieldChoice[] {
  const options: CvFieldChoice[] = [];
  if (cv.basics.summary.trim()) options.push({ label: "Professional summary", field: { kind: "summary" }, text: cv.basics.summary });
  for (const entry of cv.experience) {
    entry.highlights.forEach((text, index) => {
      if (text.trim()) options.push({ label: `${entry.company || "Experience"} · bullet ${index + 1}`, field: { kind: "experience", itemId: entry.id, index }, text });
    });
  }
  for (const entry of cv.projects) {
    entry.highlights.forEach((text, index) => {
      if (text.trim()) options.push({ label: `${entry.name || "Project"} · bullet ${index + 1}`, field: { kind: "project", itemId: entry.id, index }, text });
    });
  }
  return options;
}

/** Map a grounded review evidence quote back to the draft field it came from,
 * so an approved rewrite can be applied in place. Matches on normalized text
 * (either contains the other) and picks the strongest overlap. Returns null
 * when nothing matches well enough to edit safely. */
export function cvFieldForEvidence(cv: CVData, evidence: string): CvField | null {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const target = norm(evidence);
  if (target.length < 8) return null;
  let best: { field: CvField; score: number } | null = null;
  for (const choice of cvFieldChoices(cv)) {
    const t = norm(choice.text);
    if (t.includes(target) || target.includes(t)) {
      const score = Math.min(t.length, target.length);
      if (!best || score > best.score) best = { field: choice.field, score };
    }
  }
  return best?.field ?? null;
}

export function parseCvField(value: unknown): CvField | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (o.kind === "summary") return { kind: "summary" };
  if ((o.kind !== "experience" && o.kind !== "project") ||
    typeof o.itemId !== "string" || o.itemId.length > 100 ||
    typeof o.index !== "number" || !Number.isSafeInteger(o.index) || o.index < 0 || o.index > 200) return null;
  return { kind: o.kind, itemId: o.itemId, index: o.index };
}
