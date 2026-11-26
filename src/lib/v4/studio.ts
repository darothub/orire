import { ALL_SECTIONS, SECTION_LABELS, type CVData, type SectionKey } from "@/lib/cv/schema";
import { analyzeBullet, type CoachFlag } from "@/lib/cv/coach";

export interface BlockRow {
  key: SectionKey;
  label: string;
  visible: boolean;
  /** Position among visible sections (0-based); -1 when hidden. */
  index: number;
  empty: boolean;
}

function isEmpty(cv: CVData, key: SectionKey): boolean {
  switch (key) {
    case "summary": return !cv.basics.summary.trim();
    case "experience": return cv.experience.length === 0;
    case "education": return cv.education.length === 0;
    case "skills": return cv.skills.every((g) => g.items.length === 0);
    case "projects": return cv.projects.length === 0;
    case "certifications": return cv.certifications.length === 0;
  }
}

/** Sections in display order: visible ones as laid out, then hidden ones. */
export function blockRows(cv: CVData): BlockRow[] {
  const visible = cv.order.filter((k) => ALL_SECTIONS.includes(k));
  const hidden = ALL_SECTIONS.filter((k) => !visible.includes(k));
  return [...visible, ...hidden].map((key) => ({
    key,
    label: SECTION_LABELS[key],
    visible: visible.includes(key),
    index: visible.indexOf(key),
    empty: isEmpty(cv, key),
  }));
}

/** The first visible section with nothing in it: the gold "Next" marker. */
export function nextBlock(cv: CVData): SectionKey | null {
  return blockRows(cv).find((r) => r.visible && r.empty)?.key ?? null;
}

export type RoleKind = "experience" | "project";
export interface RoleOption {
  kind: RoleKind;
  id: string;
  /** Short name for a chip: role at company, or project name. */
  label: string;
}

/** Everything that has bullets, in CV order: roles first, then projects. */
export function roleOptions(cv: CVData): RoleOption[] {
  const roles = cv.experience.map((e) => ({
    kind: "experience" as const,
    id: e.id,
    label: [e.role, e.company].map((s) => s.trim()).filter(Boolean).join(", ") || "Untitled role",
  }));
  const projects = cv.projects.map((p) => ({ kind: "project" as const, id: p.id, label: p.name.trim() || "Untitled project" }));
  return [...roles, ...projects];
}

export interface FlaggedBullet {
  kind: RoleKind;
  id: string;
  roleLabel: string;
  index: number;
  text: string;
  flags: CoachFlag[];
}

/** Every bullet the local coach flags, with where it lives. */
export function flaggedBullets(cv: CVData): FlaggedBullet[] {
  const out: FlaggedBullet[] = [];
  for (const r of roleOptions(cv)) {
    const bullets = r.kind === "experience" ? cv.experience.find((e) => e.id === r.id)?.highlights : cv.projects.find((p) => p.id === r.id)?.highlights;
    (bullets ?? []).forEach((text, index) => {
      if (!text.trim()) return;
      const flags = analyzeBullet(text);
      if (flags.length > 0) out.push({ kind: r.kind, id: r.id, roleLabel: r.label, index, text, flags });
    });
  }
  return out;
}
