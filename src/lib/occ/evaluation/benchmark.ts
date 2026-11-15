import { parseInterviewFeedback } from "../interview";
import { INTERVIEW_BENCHMARK_V1, type EvaluationCase } from "./fixtures";

/** Only synthetically-labeled, deterministic benchmark results.
 * This cannot score natural language clarity or user confidence.
 */
export type MachineEvaluation = {
  fixtureCount: number;
  professions: string[];
  unsafeRejected: number;
  unsafeTotal: number;
  safeAccepted: number;
  safeTotal: number;
  falseAcceptances: string[];
  falseRejections: string[];
  byProfession: Record<string, { total: number; passed: number; failures: string[] }>;
};
export function evaluateInterviewBenchmark(cases: readonly EvaluationCase[] = INTERVIEW_BENCHMARK_V1): MachineEvaluation {
  const byProfession: MachineEvaluation["byProfession"] = {};
  const falseAcceptances: string[] = [];
  const falseRejections: string[] = [];
  let unsafeRejected = 0;
  let unsafeTotal = 0;
  let safeAccepted = 0;
  let safeTotal = 0;
  for (const item of cases) {
    const output = parseInterviewFeedback(JSON.stringify({
      strength: "Thanks for sharing your experience.",
      improvement: "Consider adding a relevant, real example.",
      followUp: "What did you learn?",
      betterWording: item.proposedRewrite,
      whyBetter: "This is easier to follow.",
    }), item.originalAnswer);
    const actual = output.wordingStatus;
    const entry = byProfession[item.discipline] ??= { total: 0, passed: 0, failures: [] };
    entry.total++;
    if (actual === item.expected) entry.passed++;
    else entry.failures.push(item.id);
    if (item.expected === "copyedit") {
      unsafeTotal++;
      if (actual === "copyedit") unsafeRejected++;
      else falseAcceptances.push(item.id);
    } else {
      safeTotal++;
      if (actual === "grounded") safeAccepted++;
      else falseRejections.push(item.id);
    }
  }
  return {
    fixtureCount: cases.length,
    professions: Object.keys(byProfession).sort(),
    unsafeRejected, unsafeTotal, safeAccepted, safeTotal,
    falseAcceptances, falseRejections, byProfession,
  };
}

/** Two *distinct real humans* must review each case before it counts as reviewed.
 * Never populate these records with model-generated labels or synthetic reviewers.
 */
export type HumanReview = {
  caseId: string;
  reviewerId: string;
  reviewedAt: string;
  clarity: 1 | 2 | 3 | 4 | 5;
  recognizability: 1 | 2 | 3 | 4 | 5;
  meaningPreserved: boolean;
  fabricatedClaim: boolean;
  notes: string;
};
export type HumanReviewSummary = {
  casesReviewedTwice: number;
  casesPending: number;
  disagreementCases: string[];
  fabricatedClaimCases: string[];
  averageClarity: number | null;
  averageRecognizability: number | null;
  meaningPreservationRate: number | null;
};
export function summarizeHumanReviews(
  reviews: readonly HumanReview[],
  cases: readonly EvaluationCase[] = INTERVIEW_BENCHMARK_V1,
): HumanReviewSummary {
  const permitted = new Set(cases.map(c => c.id));
  const perCase = new Map<string, Map<string, HumanReview>>();
  for (const review of reviews) {
    if (!permitted.has(review.caseId)) throw new Error("Unknown review case");
    if (!review.reviewerId.trim() || !Number.isFinite(Date.parse(review.reviewedAt)) ||
        !Number.isInteger(review.clarity) || review.clarity < 1 || review.clarity > 5 ||
        !Number.isInteger(review.recognizability) || review.recognizability < 1 || review.recognizability > 5 ||
        typeof review.meaningPreserved !== "boolean" || typeof review.fabricatedClaim !== "boolean" ||
        typeof review.notes !== "string") throw new Error("Invalid human review");
    const byReviewer = perCase.get(review.caseId) ?? new Map<string, HumanReview>();
    if (byReviewer.has(review.reviewerId)) throw new Error("Duplicate reviewer");
    byReviewer.set(review.reviewerId, review);
    perCase.set(review.caseId, byReviewer);
  }
  const doubleReviewed = [...perCase].filter(([, pair]) => pair.size >= 2);
  const disagreementCases: string[] = [];
  const fabricatedClaimCases: string[] = [];
  const confirmedReviews: HumanReview[] = [];
  for (const [caseId, pair] of doubleReviewed) {
    const values = [...pair.values()];
    confirmedReviews.push(...values);
    if (values.some(v => v.fabricatedClaim)) fabricatedClaimCases.push(caseId);
    if (new Set(values.map(v => v.fabricatedClaim)).size > 1 ||
        new Set(values.map(v => v.meaningPreserved)).size > 1 ||
        Math.max(...values.map(v => v.recognizability)) - Math.min(...values.map(v => v.recognizability)) >= 2) {
      disagreementCases.push(caseId);
    }
  }
  const avg = (field: "clarity" | "recognizability") => confirmedReviews.length
    ? Number((confirmedReviews.reduce((total, r) => total + r[field], 0) / confirmedReviews.length).toFixed(2))
    : null;
  return {
    casesReviewedTwice: doubleReviewed.length,
    casesPending: cases.length - doubleReviewed.length,
    disagreementCases,
    fabricatedClaimCases,
    averageClarity: avg("clarity"),
    averageRecognizability: avg("recognizability"),
    meaningPreservationRate: confirmedReviews.length
      ? confirmedReviews.filter(v => v.meaningPreserved).length / confirmedReviews.length
      : null,
  };
}
