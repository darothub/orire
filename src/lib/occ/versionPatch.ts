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

export function patchCvField(cv: CVData, field: CvField, expected: string, replacement: string): CVData | null {
  if (typeof expected !== "string" || typeof replacement !== "string" ||
      replacement.trim().length < 10 || replacement.length > 1500 ||
      readCvField(cv, field) !== expected || replacement.trim() === expected) return null;
  if (field.kind === "summary") {
    return { ...cv, basics: { ...cv.basics, summary: replacement.trim() } };
  }
  if (field.kind === "experience") {
    return { ...cv, experience: cv.experience.map(item =>
      item.id !== field.itemId ? item : {
        ...item, highlights: item.highlights.map((value, index) => index === field.index ? replacement.trim() : value),
      },
    ) };
  }
  return { ...cv, projects: cv.projects.map(item =>
    item.id !== field.itemId ? item : {
      ...item, highlights: item.highlights.map((value, index) => index === field.index ? replacement.trim() : value),
    },
  ) };
}

export type CvFieldChoice = { label: string; field: CvField; text: string };

/** The revisable fields of a CV — its summary and every non-empty experience
 * and project bullet — as a flat, selectable list. Shared by every OCC surface
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

export function parseCvField(value: unknown): CvField | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  if (o.kind === "summary") return { kind: "summary" };
  if ((o.kind !== "experience" && o.kind !== "project") ||
    typeof o.itemId !== "string" || o.itemId.length > 100 ||
    typeof o.index !== "number" || !Number.isSafeInteger(o.index) || o.index < 0 || o.index > 200) return null;
  return { kind: o.kind, itemId: o.itemId, index: o.index };
}
