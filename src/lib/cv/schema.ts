/**
 * orire — CV data model.
 *
 * Fact-grounding principle: this schema is the single source of truth for a CV.
 * Everything a template renders MUST come from a field here. Any future AI layer
 * may only restructure or rephrase values already present in this data — it must
 * never invent content that has no corresponding source field.
 */

export type ID = string;

export interface Link {
  id: ID;
  label: string;
  url: string;
}

export interface ExperienceItem {
  id: ID;
  company: string;
  role: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  /** Bullet points. Each is a discrete, editable fact. */
  highlights: string[];
}

export interface EducationItem {
  id: ID;
  institution: string;
  degree: string;
  field?: string;
  startDate?: string;
  endDate?: string;
  details?: string;
}

export interface SkillGroup {
  id: ID;
  category: string;
  /** Plain skill names — no invented proficiency levels. */
  items: string[];
}

export interface CVBasics {
  fullName: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  links: Link[];
}

/** Ordered list of section keys — drives layout order (drag reorder in Phase 1). */
export type SectionKey = "summary" | "experience" | "education" | "skills";

export interface CVData {
  basics: CVBasics;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: SkillGroup[];
  /** Render/section order. */
  order: SectionKey[];
}

export const SECTION_LABELS: Record<SectionKey, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
};

let seq = 0;
/** Stable-ish id generator for client-created items. */
export function uid(prefix = "id"): ID {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}`;
}

export function emptyExperience(): ExperienceItem {
  return {
    id: uid("exp"),
    company: "",
    role: "",
    location: "",
    startDate: "",
    endDate: "",
    current: false,
    highlights: [""],
  };
}

export function emptyEducation(): EducationItem {
  return {
    id: uid("edu"),
    institution: "",
    degree: "",
    field: "",
    startDate: "",
    endDate: "",
    details: "",
  };
}

export function emptySkillGroup(): SkillGroup {
  return { id: uid("skl"), category: "", items: [] };
}

export function emptyLink(): Link {
  return { id: uid("lnk"), label: "", url: "" };
}
