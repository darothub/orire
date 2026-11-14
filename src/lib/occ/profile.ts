export type CareerProfileInput = {
  targetRole: string; location: string; workMode: string;
  salaryGoal: string; careerGoal: string; verifiedNotes: string;
};
export const PROFILE_FIELDS = {
  targetRole: 120, location: 120, workMode: 60,
  salaryGoal: 100, careerGoal: 300, verifiedNotes: 2500,
} as const;
export function validateCareerProfile(value: unknown): CareerProfileInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const result = {} as CareerProfileInput;
  for (const [field, limit] of Object.entries(PROFILE_FIELDS)) {
    const val = body[field];
    if (typeof val !== "string" || val.length > limit) return null;
    (result as unknown as Record<string, string>)[field] = val.trim();
  }
  return result;
}
