import type { CVData } from "@/lib/cv/schema";

/** Count the fact-bearing items in a CV, used for before/after deltas. */
export function countFacts(cv: CVData) {
  return {
    experience: cv.experience.length,
    education: cv.education.length,
    projects: cv.projects.length,
    certifications: cv.certifications.length,
    skills: cv.skills.reduce((a, g) => a + g.items.length, 0),
  };
}

export type FactCounts = ReturnType<typeof countFacts>;
