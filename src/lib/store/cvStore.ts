"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type CVData,
  type ExperienceItem,
  type EducationItem,
  type SkillGroup,
  emptyExperience,
  emptyEducation,
  emptySkillGroup,
} from "@/lib/cv/schema";
import { sampleCV } from "@/lib/cv/sample";

type BasicsPatch = Partial<CVData["basics"]>;

interface CVState {
  cv: CVData;
  activeTemplate: string;

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

  setTemplate: (id: string) => void;
  setOrder: (order: CVData["order"]) => void;
  reset: () => void;
}

export const useCVStore = create<CVState>()(
  persist(
    (set) => ({
      cv: sampleCV,
      activeTemplate: "aurora",

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

      setTemplate: (id) => set({ activeTemplate: id }),
      setOrder: (order) => set((s) => ({ cv: { ...s.cv, order } })),
      reset: () => set({ cv: sampleCV, activeTemplate: "aurora" }),
    }),
    { name: "orire-cv-v1" },
  ),
);
