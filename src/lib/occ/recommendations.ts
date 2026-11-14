/** Grounded OCC advice schema. Text supplied by an LLM is not trusted. */
export type OccRecommendation = {
  requirement: string;
  cvEvidence: string | null;
  assessment: "supported" | "needs-clarification" | "not-found";
  suggestion: string;
  question: string | null;
};
export type OccAdvice = { summary: string; recommendations: OccRecommendation[]; nextSteps: string[]; disclaimer: string };
const MAX_ITEMS = 6;
const str = (x: unknown, max: number) => typeof x === "string" ? x.trim().slice(0, max) : "";
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
function normalize(s: string) { return s.toLowerCase().replace(/\s+/g, " ").trim(); }
/** Require every claimed evidence quote to occur verbatim in the supplied CV. */
export function parseGroundedAdvice(raw: string, cv: string): OccAdvice {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Invalid agent response."); }
  if (!isObj(parsed) || !Array.isArray(parsed.recommendations)) throw new Error("Invalid agent response.");
  const recommendations = parsed.recommendations.slice(0, MAX_ITEMS).flatMap((item): OccRecommendation[] => {
    if (!isObj(item)) return [];
    const requirement = str(item.requirement, 140);
    const suggestion = str(item.suggestion, 350);
    const proposedEvidence = str(item.cvEvidence, 250);
    const grounded = proposedEvidence.length >= 10 && normalize(cv).includes(normalize(proposedEvidence));
    const assessment = item.assessment === "supported" && grounded
      ? "supported"
      : item.assessment === "not-found" ? "not-found" : "needs-clarification";
    if (!requirement || !suggestion) return [];
    return [{
      requirement,
      cvEvidence: grounded ? proposedEvidence : null,
      assessment,
      suggestion,
      question: str(item.question, 200) || null,
    }];
  });
  if (recommendations.length === 0) throw new Error("No valid recommendations.");
  return {
    summary: str(parsed.summary, 450) || "Review the role requirements against your verified experience.",
    recommendations,
    nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.slice(0, 4).map(x => str(x, 200)).filter(Boolean) : [],
    disclaimer: "AI suggestions are estimates, not ATS scores, hiring predictions or verified credentials. Check every recommendation before applying it to your CV.",
  };
}
