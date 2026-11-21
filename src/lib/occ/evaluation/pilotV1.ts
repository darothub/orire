import { INTERVIEW_BENCHMARK_V1, type EvaluationCase } from "./fixtures";
import { createBlindReviewPacket, type BlindReviewCase } from "./reviewQueue";
import { summarizeHumanReviews, type HumanReview } from "./benchmark";

/**
 * OCC 3.2.3 frozen first pilot: exactly eight existing synthetic cases.
 * Two per profession (medicine, law, agriculture, nursing).
 * IDs and inclusion criteria are coordinator-side only; never distribute labels
 * or the original fixtures.ts to reviewers.
 */
export const PILOT_V1_CASE_IDS = [
  "medicine-safe-01", "medicine-risk-01",
  "law-safe-01", "law-risk-01",
  "agriculture-safe-01", "agriculture-risk-01",
  "nursing-safe-01", "nursing-risk-01",
] as const;

export function createPilotV1Packet(cases: readonly EvaluationCase[] = INTERVIEW_BENCHMARK_V1): BlindReviewCase[] {
  return createBlindReviewPacket(PILOT_V1_CASE_IDS, cases);
}

/** Pilot-only gates must not be confused with completion of the full 42-case benchmark. */
export function getPilotV1Status(
  reviews: readonly HumanReview[] = [],
  cases: readonly EvaluationCase[] = INTERVIEW_BENCHMARK_V1,
) {
  const selected = cases.filter(item => PILOT_V1_CASE_IDS.some(id => id === item.id));
  if (selected.length !== PILOT_V1_CASE_IDS.length) throw new Error("Pilot fixtures missing");
  // Validate against the entire fixture registry; do not allow an unknown reviewer entry.
  summarizeHumanReviews(reviews, cases);
  const pilotReviews = reviews.filter(review => PILOT_V1_CASE_IDS.some(id => id === review.caseId));
  const summary = summarizeHumanReviews(pilotReviews, selected);
  const reviewedCaseIds = new Set(pilotReviews.map(item => item.caseId));
  return {
    pilotId: "occ-interview-pilot-v1",
    source: "existing-synthetic-fixtures",
    totalCases: selected.length,
    requiredIndependentReviews: selected.length * 2,
    receivedRecords: pilotReviews.length,
    doubleReviewedCases: summary.casesReviewedTwice,
    pendingCases: summary.casesPending,
    outstandingCaseIds: PILOT_V1_CASE_IDS.filter(id => !reviewedCaseIds.has(id) ||
      pilotReviews.filter(item => item.caseId === id).length < 2),
    fabricatedClaimCases: summary.fabricatedClaimCases,
    disagreementCases: summary.disagreementCases,
    averageClarity: summary.averageClarity,
    averageRecognizability: summary.averageRecognizability,
    meaningPreservationRate: summary.meaningPreservationRate,
    readyForFindings: summary.casesPending === 0 &&
      summary.disagreementCases.length === 0 &&
      summary.fabricatedClaimCases.length === 0 &&
      summary.meaningPreservationRate === 1,
  };
}
