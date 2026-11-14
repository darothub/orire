import type { CareerProfileInput } from "./profile";

/** Only caller-authorized stored context is passed to the reasoning model. */
export function buildCareerContext(
  useSavedProfile: boolean,
  savedProfile: CareerProfileInput | null,
  inlineGoal: string,
) {
  if (!useSavedProfile || !savedProfile) {
    return { careerGoal: inlineGoal.trim(), savedCareerContext: null, usedSavedProfile: false };
  }
  return {
    careerGoal: inlineGoal.trim() || savedProfile.careerGoal,
    savedCareerContext: {
      targetRole: savedProfile.targetRole,
      location: savedProfile.location,
      workMode: savedProfile.workMode,
      salaryGoal: savedProfile.salaryGoal,
      careerGoal: savedProfile.careerGoal,
      // User-provided, not verified evidence of employment.
      userProvidedExperienceNotes: savedProfile.verifiedNotes,
    },
    usedSavedProfile: true,
  };
}
