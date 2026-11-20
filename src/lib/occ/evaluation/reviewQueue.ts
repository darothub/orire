import { INTERVIEW_BENCHMARK_V1, type EvaluationCase } from "./fixtures";
import { OCCUPATIONAL_FAMILIES } from "./coverage";
import { summarizeHumanReviews, type HumanReview } from "./benchmark";

/** A reviewer sees neither the expected outcome nor the synthetic risk label. */
export type BlindReviewCase = {
  caseId: string;
  discipline: string;
  question: string;
  originalAnswer: string;
  proposedRewrite: string;
};
export type ReviewQueueItem = {
  caseId: string;
  discipline: string;
  priority: "elevated" | "standard";
  completedIndependentReviews: number;
  reviewsRemaining: number;
};
const priorityByFamily = new Map(OCCUPATIONAL_FAMILIES.map(family => [family.id, family.reviewPriority]));

/** Deterministic queue; a first review never counts as an independently completed case. */
export function getHumanReviewQueue(
  cases: readonly EvaluationCase[] = INTERVIEW_BENCHMARK_V1,
  reviews: readonly HumanReview[] = [],
): ReviewQueueItem[] {
  summarizeHumanReviews(reviews, cases);
  const reviewers = new Map<string, Set<string>>();
  for (const review of reviews) {
    const present = reviewers.get(review.caseId) ?? new Set<string>();
    present.add(review.reviewerId);
    reviewers.set(review.caseId, present);
  }
  return cases.map(item => {
    const completedIndependentReviews = reviewers.get(item.id)?.size ?? 0;
    return {
      caseId: item.id,
      discipline: item.discipline,
      priority: priorityByFamily.get(item.discipline) ?? "standard",
      completedIndependentReviews,
      reviewsRemaining: Math.max(0, 2 - completedIndependentReviews),
    };
  }).filter(item => item.reviewsRemaining > 0)
    .sort((a, b) => Number(b.priority === "elevated") - Number(a.priority === "elevated") ||
      a.completedIndependentReviews - b.completedIndependentReviews ||
      a.discipline.localeCompare(b.discipline) || a.caseId.localeCompare(b.caseId));
}

/** Never include internal expected/safety classifications in blinded packets. */
export function createBlindReviewPacket(
  caseIds: readonly string[],
  cases: readonly EvaluationCase[] = INTERVIEW_BENCHMARK_V1,
): BlindReviewCase[] {
  const byId = new Map(cases.map(item => [item.id, item]));
  if (new Set(caseIds).size !== caseIds.length) throw new Error("Duplicate packet case");
  return caseIds.map(caseId => {
    const item = byId.get(caseId);
    if (!item) throw new Error("Unknown packet case");
    return {
      caseId: item.id,
      discipline: item.discipline,
      question: item.question,
      originalAnswer: item.originalAnswer,
      proposedRewrite: item.proposedRewrite,
    };
  });
}

/** A compact set of highest-priority cases for a first independent review round. */
export function createPriorityReviewPacket(
  maxCases = 12,
  cases: readonly EvaluationCase[] = INTERVIEW_BENCHMARK_V1,
  reviews: readonly HumanReview[] = [],
): BlindReviewCase[] {
  if (!Number.isInteger(maxCases) || maxCases < 1 || maxCases > 100) throw new Error("Invalid packet size");
  return createBlindReviewPacket(getHumanReviewQueue(cases, reviews).slice(0, maxCases).map(row => row.caseId), cases);
}
