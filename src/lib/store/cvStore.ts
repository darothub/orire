"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type CVData,
  type ExperienceItem,
  type EducationItem,
  type SkillGroup,
  type ProjectItem,
  type CertificationItem,
  type SectionKey,
  ALL_SECTIONS,
  emptyExperience,
  emptyEducation,
  emptySkillGroup,
  emptyProject,
  emptyCertification,
} from "@/lib/cv/schema";
import { sampleCV } from "@/lib/cv/sample";
import type { ParsedCV } from "@/lib/ingest/parse";

type BasicsPatch = Partial<CVData["basics"]>;
export type ImportMode = "replace" | "merge";

interface CVState {
  cv: CVData;
  activeTemplate: string;
  /** Snapshot of the CV before the first AI refinement — the "initial" for rating (req 16). */
  baseline: CVData | null;

  setBasics: (patch: BasicsPatch) => void;

  addExperience: () => void;
  updateExperience: (id: string, patch: Partial<ExperienceItem>) => void;
  removeExperience: (id: string) => void;
  setHighlight: (expId: string, index: number, value: string) => void;
  addHighlight: (expId: string) => void;
  removeHighlight: (expId: string, index: number) => void;

  addEducation: () => void;
  updateEducation: (id: string, patch: Partial<EducationItem>) => void;
  removeEducation: (id: string) => void;

  addSkillGroup: () => void;
  updateSkillGroup: (id: string, patch: Partial<SkillGroup>) => void;
  removeSkillGroup: (id: string) => void;

  addProject: () => void;
  updateProject: (id: string, patch: Partial<ProjectItem>) => void;
  removeProject: (id: string) => void;
  setProjectHighlight: (prjId: string, index: number, value: string) => void;
  addProjectHighlight: (prjId: string) => void;
  removeProjectHighlight: (prjId: string, index: number) => void;

  addCertification: () => void;
  updateCertification: (id: string, patch: Partial<CertificationItem>) => void;
  removeCertification: (id: string) => void;

  setTemplate: (id: string) => void;
  setOrder: (order: CVData["order"]) => void;
  toggleSection: (key: SectionKey) => void;
  /** Drag-to-reorder within a section (req 17). */
  setExperience: (next: ExperienceItem[]) => void;
  setEducation: (next: EducationItem[]) => void;
  setSkills: (next: SkillGroup[]) => void;
  setProjects: (next: ProjectItem[]) => void;
  setCertifications: (next: CertificationItem[]) => void;
  setHighlights: (expId: string, next: string[]) => void;
  setProjectHighlights: (prjId: string, next: string[]) => void;
  applyImport: (parsed: ParsedCV, mode: ImportMode) => void;
  /** Replace CV content with an AI-refined, fact-grounded result. */
  applyRefinedCV: (next: CVData) => void;
  /** Manually snapshot the current CV as the initial baseline for rating. */
  captureBaseline: () => void;
  /** Forget the stored baseline. */
  clearBaseline: () => void;
  reset: () => void;
}

export const useCVStore = create<CVState>()(
  persist(
    (set) => ({
      cv: sampleCV,
      activeTemplate: "aurora",
      baseline: null,

      setBasics: (patch) =>
        set((s) => ({ cv: { ...s.cv, basics: { ...s.cv.basics, ...patch } } })),

      addExperience: () =>
        set((s) => ({ cv: { ...s.cv, experience: [...s.cv.experience, emptyExperience()] } })),
      updateExperience: (id, patch) =>
        set((s) => ({
          cv: {
            ...s.cv,
            experience: s.cv.experience.map((e) => (e.id === id ? { ...e, ...patch } : e)),
          },
        })),
      removeExperience: (id) =>
        set((s) => ({ cv: { ...s.cv, experience: s.cv.experience.filter((e) => e.id !== id) } })),
      setHighlight: (expId, index, value) =>
        set((s) => ({
          cv: {
            ...s.cv,
            experience: s.cv.experience.map((e) =>
              e.id === expId
                ? { ...e, highlights: e.highlights.map((h, i) => (i === index ? value : h)) }
                : e,
            ),
          },
        })),
      addHighlight: (expId) =>
        set((s) => ({
          cv: {
            ...s.cv,
            experience: s.cv.experience.map((e) =>
              e.id === expId ? { ...e, highlights: [...e.highlights, ""] } : e,
            ),
          },
        })),
      removeHighlight: (expId, index) =>
        set((s) => ({
          cv: {
            ...s.cv,
            experience: s.cv.experience.map((e) =>
              e.id === expId
                ? { ...e, highlights: e.highlights.filter((_, i) => i !== index) }
                : e,
            ),
          },
        })),

      addEducation: () =>
        set((s) => ({ cv: { ...s.cv, education: [...s.cv.education, emptyEducation()] } })),
      updateEducation: (id, patch) =>
        set((s) => ({
          cv: {
            ...s.cv,
            education: s.cv.education.map((e) => (e.id === id ? { ...e, ...patch } : e)),
          },
        })),
      removeEducation: (id) =>
        set((s) => ({ cv: { ...s.cv, education: s.cv.education.filter((e) => e.id !== id) } })),

      addSkillGroup: () =>
        set((s) => ({ cv: { ...s.cv, skills: [...s.cv.skills, emptySkillGroup()] } })),
      updateSkillGroup: (id, patch) =>
        set((s) => ({
          cv: {
            ...s.cv,
            skills: s.cv.skills.map((g) => (g.id === id ? { ...g, ...patch } : g)),
          },
        })),
      removeSkillGroup: (id) =>
        set((s) => ({ cv: { ...s.cv, skills: s.cv.skills.filter((g) => g.id !== id) } })),

      addProject: () =>
        set((s) => ({ cv: { ...s.cv, projects: [...s.cv.projects, emptyProject()] } })),
      updateProject: (id, patch) =>
        set((s) => ({
          cv: {
            ...s.cv,
            projects: s.cv.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          },
        })),
      removeProject: (id) =>
        set((s) => ({ cv: { ...s.cv, projects: s.cv.projects.filter((p) => p.id !== id) } })),
      setProjectHighlight: (prjId, index, value) =>
        set((s) => ({
          cv: {
            ...s.cv,
            projects: s.cv.projects.map((p) =>
              p.id === prjId
                ? { ...p, highlights: p.highlights.map((h, i) => (i === index ? value : h)) }
                : p,
            ),
          },
        })),
      addProjectHighlight: (prjId) =>
        set((s) => ({
          cv: {
            ...s.cv,
            projects: s.cv.projects.map((p) =>
              p.id === prjId ? { ...p, highlights: [...p.highlights, ""] } : p,
            ),
          },
        })),
      removeProjectHighlight: (prjId, index) =>
        set((s) => ({
          cv: {
            ...s.cv,
            projects: s.cv.projects.map((p) =>
              p.id === prjId
                ? { ...p, highlights: p.highlights.filter((_, i) => i !== index) }
                : p,
            ),
          },
        })),

      addCertification: () =>
        set((s) => ({
          cv: { ...s.cv, certifications: [...s.cv.certifications, emptyCertification()] },
        })),
      updateCertification: (id, patch) =>
        set((s) => ({
          cv: {
            ...s.cv,
            certifications: s.cv.certifications.map((c) =>
              c.id === id ? { ...c, ...patch } : c,
            ),
          },
        })),
      removeCertification: (id) =>
        set((s) => ({
          cv: { ...s.cv, certifications: s.cv.certifications.filter((c) => c.id !== id) },
        })),

      setTemplate: (id) => set({ activeTemplate: id }),
      setOrder: (order) => set((s) => ({ cv: { ...s.cv, order } })),

      setExperience: (next) => set((s) => ({ cv: { ...s.cv, experience: next } })),
      setEducation: (next) => set((s) => ({ cv: { ...s.cv, education: next } })),
      setSkills: (next) => set((s) => ({ cv: { ...s.cv, skills: next } })),
      setProjects: (next) => set((s) => ({ cv: { ...s.cv, projects: next } })),
      setCertifications: (next) => set((s) => ({ cv: { ...s.cv, certifications: next } })),
      setHighlights: (expId, next) =>
        set((s) => ({
          cv: {
            ...s.cv,
            experience: s.cv.experience.map((e) => (e.id === expId ? { ...e, highlights: next } : e)),
          },
        })),
      setProjectHighlights: (prjId, next) =>
        set((s) => ({
          cv: {
            ...s.cv,
            projects: s.cv.projects.map((p) => (p.id === prjId ? { ...p, highlights: next } : p)),
          },
        })),
      toggleSection: (key) =>
        set((s) => {
          const present = s.cv.order.includes(key);
          if (present) {
            return { cv: { ...s.cv, order: s.cv.order.filter((k) => k !== key) } };
          }
          // Re-insert at its canonical position so placement stays sensible.
          const canonicalIdx = ALL_SECTIONS.indexOf(key);
          const next = [...s.cv.order];
          let insertAt = next.length;
          for (let i = 0; i < next.length; i++) {
            if (ALL_SECTIONS.indexOf(next[i]) > canonicalIdx) {
              insertAt = i;
              break;
            }
          }
          next.splice(insertAt, 0, key);
          return { cv: { ...s.cv, order: next } };
        }),

      applyImport: (parsed, mode) =>
        set((s) => {
          const p = parsed.basics;
          if (mode === "replace") {
            return {
              cv: {
                ...s.cv,
                basics: {
                  fullName: p.fullName ?? "",
                  title: p.title ?? "",
                  email: p.email ?? "",
                  phone: p.phone ?? "",
                  location: p.location ?? "",
                  summary: p.summary ?? "",
                  links: p.links ?? [],
                },
                experience: parsed.experience,
                education: parsed.education,
                skills: parsed.skills,
                projects: parsed.projects ?? [],
                certifications: parsed.certifications ?? [],
              },
            };
          }
          // merge: only fill empty basics fields; append list items.
          const b = s.cv.basics;
          return {
            cv: {
              ...s.cv,
              basics: {
                fullName: b.fullName || p.fullName || "",
                title: b.title || p.title || "",
                email: b.email || p.email || "",
                phone: b.phone || p.phone || "",
                location: b.location || p.location || "",
                summary: b.summary || p.summary || "",
                links: b.links.length ? b.links : p.links ?? [],
              },
              experience: [...s.cv.experience, ...parsed.experience],
              education: [...s.cv.education, ...parsed.education],
              skills: [...s.cv.skills, ...parsed.skills],
              projects: [...s.cv.projects, ...(parsed.projects ?? [])],
              certifications: [...s.cv.certifications, ...(parsed.certifications ?? [])],
            },
          };
        }),

      // Capture the pre-refine CV as the baseline the first time AI is applied,
      // so the final result can be rated against where the user started (req 16).
      applyRefinedCV: (next) =>
        set((s) => ({ cv: next, baseline: s.baseline ?? s.cv })),

      captureBaseline: () => set((s) => ({ baseline: s.cv })),
      clearBaseline: () => set({ baseline: null }),

      reset: () => set({ cv: sampleCV, activeTemplate: "aurora", baseline: null }),
    }),
    {
      name: "orire-cv-v1",
      version: 2,
      migrate: (persisted, version) => {
        const st = persisted as { cv?: Partial<CVData> } | undefined;
        if (st?.cv && version < 2) {
          const cv = st.cv as CVData;
          cv.projects = cv.projects ?? [];
          cv.certifications = cv.certifications ?? [];
          const order: SectionKey[] = Array.isArray(cv.order) ? [...cv.order] : [];
          for (const k of ALL_SECTIONS) if (!order.includes(k)) order.push(k);
          cv.order = order;
        }
        return st as unknown;
      },
    },
  ),
);
