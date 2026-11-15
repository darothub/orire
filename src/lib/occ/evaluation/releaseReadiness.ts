import { evaluateInterviewBenchmark, summarizeHumanReviews, type HumanReview } from "./benchmark";
import { getInterviewCoverage } from "./coverage";
import { INTERVIEW_BENCHMARK_V1, type EvaluationCase } from "./fixtures";

/**
 * M8.3 is a release decision, not an inference score.
 * All manual verifications default to false; CI must never certify a live
 * provider, privacy practice or rollback merely because fixtures passed.
 */
export type ReleaseAttestations = {
  authorizedProviderSmoke: boolean;
  privacyAndConsentReviewed: boolean;
  rollbackVerified: boolean;
  productArchitectureApproved: boolean;
  independentReviewProvenanceVerified: boolean;
};

export const NO_RELEASE_ATTESTATIONS: Readonly<ReleaseAttestations> = {
  authorizedProviderSmoke: false,
  privacyAndConsentReviewed: false,
  rollbackVerified: false,
  productArchitectureApproved: false,
  independentReviewProvenanceVerified: false,
};

export type M8ReleaseReadiness = {
  approved: boolean;
  benchmarkCases: number;
  doubleReviewedCases: number;
  outstandingAssessments: number;
  averageClarity: number | null;
  averageRecognizability: number | null;
  blockers: string[];
};

export function assessM8ReleaseReadiness(
  reviews: readonly HumanReview[],
  attestations: Readonly<ReleaseAttestations> = NO_RELEASE_ATTESTATIONS,
  cases: readonly EvaluationCase[] = INTERVIEW_BENCHMARK_V1,
): M8ReleaseReadiness {
  const machine = evaluateInterviewBenchmark(cases);
  const human = summarizeHumanReviews(reviews, cases);
  const coverage = getInterviewCoverage(cases, reviews);
  const blockers: string[] = [];

  if (cases.length === 0) blockers.push("No benchmark cases supplied");
  if (coverage.unregisteredFixtureFamilies.length)
    blockers.push("Unregistered occupational families in benchmark");
  if (coverage.sampled.some(f => f.syntheticCases > 0 && f.status !== "human-reviewed"))
    blockers.push("Profession coverage has not been independently reviewed");
  if (machine.falseAcceptances.length)
    blockers.push("Synthetic benchmark has false acceptances");
  if (machine.falseRejections.length)
    blockers.push("Synthetic benchmark has false rejections requiring triage");
  if (human.casesPending)
    blockers.push(`Independent double review incomplete: ${human.casesPending} cases pending`);
  if (human.disagreementCases.length)
    blockers.push("Human reviewer disagreements require adjudication");
  if (human.fabricatedClaimCases.length)
    blockers.push("Human reviewers flagged invented claims");
  if (human.meaningPreservationRate !== 1)
    blockers.push("Meaning preservation not independently established for every reviewed answer");
  if (human.averageClarity === null || human.averageClarity < 4)
    blockers.push("Clarity threshold not established");
  if (human.averageRecognizability === null || human.averageRecognizability < 4)
    blockers.push("Recognizability threshold not established");
  if (reviews.some(r => r.clarity < 3 || r.recognizability < 3))
    blockers.push("Low-scoring review cases require investigation");

  const confirmations: { key: keyof ReleaseAttestations; message: string }[] = [
    { key: "authorizedProviderSmoke", message: "Authorized live-provider smoke not verified" },
    { key: "privacyAndConsentReviewed", message: "Privacy and consent review not verified" },
    { key: "rollbackVerified", message: "Rollback and feature-flag kill switch not verified" },
    { key: "productArchitectureApproved", message: "Product and architecture approval missing" },
    { key: "independentReviewProvenanceVerified", message: "Independent human review provenance not verified" },
  ];
  for (const item of confirmations) {
    if (attestations[item.key] !== true) blockers.push(item.message);
  }

  return {
    approved: blockers.length === 0,
    benchmarkCases: cases.length,
    doubleReviewedCases: human.casesReviewedTwice,
    outstandingAssessments: human.casesPending * 2,
    averageClarity: human.averageClarity,
    averageRecognizability: human.averageRecognizability,
    blockers,
  };
}
