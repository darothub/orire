import { INTERVIEW_BENCHMARK_V1, type EvaluationCase } from "./fixtures";
import { getInterviewCoverage } from "./coverage";
import { parseInterviewFeedback } from "../interview";

/**
 * Blind, synthetic-only review material containing the wording that the product
 * would ACTUALLY display after server validation. Never ask reviewers to score
 * a rejected raw model proposal as though the candidate would see it.
 * No expected outcome, safety classification, or rejection status is leaked.
 * Actual reviewers must be recruited and work independently.
 */
export type ReviewPacketItem = {
  caseId: string;
  profession: string;
  question: string;
  candidateAnswer: string;
  suggestedWording: string;
  clarity: null;
  recognizability: null;
  meaningPreserved: null;
  fabricatedClaim: null;
  notes: "";
};
export function makeBlindInterviewReviewPacket(
  cases: readonly EvaluationCase[] = INTERVIEW_BENCHMARK_V1,
): ReviewPacketItem[] {
  const ids = new Set<string>();
  for (const item of cases) {
    if (!item.id || ids.has(item.id) || !item.discipline || !item.originalAnswer || !item.proposedRewrite) {
      throw new Error("Review cases require unique IDs, a profession and both answer versions");
    }
    ids.add(item.id);
  }
  return cases.map(item => ({
    caseId: item.id,
    profession: item.discipline,
    question: item.question,
    candidateAnswer: item.originalAnswer,
    suggestedWording: parseInterviewFeedback(JSON.stringify({
      strength: "Thank you for sharing your experience.",
      improvement: "Use a genuine example if it helps explain your work.",
      followUp: "What did you learn from this?",
      betterWording: item.proposedRewrite,
      whyBetter: "This makes your answer easier to follow.",
    }), item.originalAnswer).betterWording ?? "",
    clarity: null,
    recognizability: null,
    meaningPreserved: null,
    fabricatedClaim: null,
    notes: "",
  }));
}

export function reviewReadinessSummary(cases: readonly EvaluationCase[] = INTERVIEW_BENCHMARK_V1) {
  const coverage = getInterviewCoverage(cases, []);
  return {
    benchmarkVersion: "v1",
    syntheticCases: cases.length,
    families: coverage.sampled.length,
    elevatedFamilies: coverage.sampled.filter(f => f.priority === "elevated").map(f => f.id),
    explicitlyNotSampled: coverage.explicitlyNotSampled,
    humanReviewsComplete: 0,
    humanReviewStatus: "pending" as const,
    minimumIndependentAssessments: cases.length * 2,
  };
}
