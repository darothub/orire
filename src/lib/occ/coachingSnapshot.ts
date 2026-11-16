/**
 * P6A contract only. No database writes and no implicit persistence.
 *
 * IMPORTANT: recommendation.cvEvidence may quote portions of an uploaded CV;
 * interview.answer may contain personal information. These snapshots are
 * sensitive user content, even when no full uploaded document is stored.
 * Explicit informed opt-in is required before any future save endpoint calls
 * this parser. Parsing validates shape/size, NOT the truth of user claims.
 */

export type OccReviewSnapshot = {
  kind: "review";
  summary: string;
  recommendations: {
    requirement: string;
    assessment: "supported" | "needs-clarification" | "not-found";
    cvEvidence: string | null;
    suggestion: string;
    sampleWording: string | null;
    question: string | null;
  }[];
  nextSteps: string[];
  disclaimer: string;
};
export type OccInterviewSnapshot = {
  kind: "interview";
  question: string;
  focus: string;
  answer: string;
  strength: string;
  improvement: string;
  followUp: string;
  betterWording: string | null;
  disclaimer: string;
};
export type OccCoachingSnapshot = OccReviewSnapshot | OccInterviewSnapshot;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const exactKeys = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).every(key => keys.includes(key));

const validText = (v: unknown, max: number, allowEmpty = false): v is string =>
  typeof v === "string" && v.length <= max && (allowEmpty || v.trim().length > 0);

const optionalText = (v: unknown, max: number) =>
  v === null || validText(v, max);

function validateReview(x: Record<string, unknown>): x is OccReviewSnapshot {
  if (!exactKeys(x, ["kind", "summary", "recommendations", "nextSteps", "disclaimer"]) ||
      !validText(x.summary, 450) || !validText(x.disclaimer, 450) ||
      !Array.isArray(x.recommendations) || x.recommendations.length < 1 || x.recommendations.length > 6 ||
      !Array.isArray(x.nextSteps) || x.nextSteps.length > 4 ||
      !x.nextSteps.every(v => validText(v, 200))) return false;

  return x.recommendations.every(r => {
    if (!isRecord(r) || !exactKeys(r, ["requirement", "assessment", "cvEvidence", "suggestion", "sampleWording", "question"])) return false;
    if (!validText(r.requirement, 140) || !validText(r.suggestion, 350) ||
        !optionalText(r.cvEvidence, 250) || !optionalText(r.sampleWording, 250) ||
        !optionalText(r.question, 200) ||
        !["supported", "needs-clarification", "not-found"].includes(String(r.assessment))) return false;
    // Only accepted supported claims can carry CV-excerpt-derived sample wording.
    if (r.assessment === "supported") return validText(r.cvEvidence, 250);
    return r.sampleWording === null;
  });
}
function validateInterview(x: Record<string, unknown>): x is OccInterviewSnapshot {
  return exactKeys(x, ["kind", "question", "focus", "answer", "strength", "improvement", "followUp", "betterWording", "disclaimer"]) &&
    validText(x.question, 400) && validText(x.focus, 160) && validText(x.answer, 4000) &&
    validText(x.strength, 400) && validText(x.improvement, 500) &&
    validText(x.followUp, 400) && optionalText(x.betterWording, 750) &&
    validText(x.disclaimer, 450);
}

/**
 * An explicit boolean opt-in is mandatory. Unknown fields (including
 * cv/jobDescription, raw provider payloads and hidden prompts) are rejected.
 * The result can be used by a later authenticated, owner-scoped save endpoint;
 * this helper intentionally has no persistence side effects.
 */
export function validateOccCoachingSnapshot(
  input: unknown,
  userConsented: boolean,
): OccCoachingSnapshot | null {
  if (userConsented !== true || !isRecord(input)) return null;
  try {
    if (JSON.stringify(input).length > 12000) return null;
  } catch { return null; }
  if (input.kind === "review" && validateReview(input)) return input;
  if (input.kind === "interview" && validateInterview(input)) return input;
  return null;
}
