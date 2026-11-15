import { evaluateInterviewBenchmark, summarizeHumanReviews, type HumanReview } from "./benchmark";
import { INTERVIEW_BENCHMARK_V1, type EvaluationCase } from "./fixtures";

/**
 * Deterministic M8.5 review coordinator. An AI agent may summarize this report
 * but NEVER invent human reviewers, assessment results, approvals or scores.
 * Human identities and private blind-ID mappings must stay out of this report.
 */
export type ReviewCoordinationReport = {
  benchmarkCases: number;
  independentAssessmentsRecorded: number;
  requiredAssessments: number;
  outstandingAssessments: number;
  casesDoubleReviewed: number;
  casesNeedingSecondReview: number;
  unresolvedCases: string[];
  disagreementCases: string[];
  fabricatedClaimCases: string[];
  machineFalseAcceptances: string[];
  machineFalseRejections: string[];
  byProfession: Record<string, { cases: number; doubleReviewed: number; awaitingReview: number }>;
  nextActions: string[];
};
export function coordinateHumanInterviewReviews(
  reviews: readonly HumanReview[],
  cases: readonly EvaluationCase[] = INTERVIEW_BENCHMARK_V1,
): ReviewCoordinationReport {
  const human = summarizeHumanReviews(reviews, cases);
  const machine = evaluateInterviewBenchmark(cases);
  const perCase = new Map<string, Set<string>>();
  for (const review of reviews) {
    const reviewers = perCase.get(review.caseId) ?? new Set<string>();
    reviewers.add(review.reviewerId);
    perCase.set(review.caseId, reviewers);
  }
  const unresolvedCases = cases.filter(c => (perCase.get(c.id)?.size ?? 0) < 2).map(c => c.id);
  const byProfession: ReviewCoordinationReport["byProfession"] = {};
  for (const c of cases) {
    const entry = byProfession[c.discipline] ??= { cases: 0, doubleReviewed: 0, awaitingReview: 0 };
    entry.cases++;
    if ((perCase.get(c.id)?.size ?? 0) >= 2) entry.doubleReviewed++;
    else entry.awaitingReview++;
  }
  const outstandingAssessments = cases.reduce(
    (total, c) => total + Math.max(0, 2 - (perCase.get(c.id)?.size ?? 0)), 0,
  );
  const nextActions: string[] = [];
  if (outstandingAssessments) nextActions.push("Recruit qualified independent assessors and collect missing genuine reviews");
  if (human.disagreementCases.length) nextActions.push("Assign independent human adjudicators to conflicting cases");
  if (human.fabricatedClaimCases.length) nextActions.push("Triage every reviewer-reported invented claim before release");
  if (machine.falseAcceptances.length || machine.falseRejections.length)
    nextActions.push("Investigate deterministic safety regression before release");
  if (!outstandingAssessments) nextActions.push("Request provenance, privacy, architecture and rollback sign-offs");
  return {
    benchmarkCases: cases.length,
    independentAssessmentsRecorded: reviews.length,
    requiredAssessments: cases.length * 2,
    outstandingAssessments,
    casesDoubleReviewed: human.casesReviewedTwice,
    casesNeedingSecondReview: unresolvedCases.length,
    unresolvedCases,
    disagreementCases: human.disagreementCases,
    fabricatedClaimCases: human.fabricatedClaimCases,
    machineFalseAcceptances: machine.falseAcceptances,
    machineFalseRejections: machine.falseRejections,
    byProfession,
    nextActions,
  };
}
