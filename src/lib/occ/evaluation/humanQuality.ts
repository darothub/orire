import { INTERVIEW_BENCHMARK_V1, type EvaluationCase } from "./fixtures";
import { OCCUPATIONAL_FAMILIES, getInterviewCoverage } from "./coverage";
import { summarizeHumanReviews, type HumanReview } from "./benchmark";

/** Fields match the reviewer-facing form, without machine verdicts or risk labels. */
export type ReviewSubmission = {
  caseId: string;
  reviewerId: string;
  reviewedAt: string;
  clarity: number;
  recognizability: number;
  meaningPreserved: boolean;
  fabricatedClaim: boolean;
  notes: string;
};
export type HumanQualityStatus = "pending-human-review" | "needs-adjudication" | "blocked-by-safety-finding" | "ready-for-release-review";
export type ProfessionQuality = {
  discipline: string;
  label: string;
  priority: "elevated" | "standard";
  totalCases: number;
  doubleReviewedCases: number;
  pendingCases: number;
  clarity: number | null;
  recognizability: number | null;
  meaningPreservationRate: number | null;
  flaggedFabrications: string[];
  disagreements: string[];
};
export type HumanQualityReport = {
  provenance: "independent-human-review-records";
  fixtureCount: number;
  independentReviewRecords: number;
  doubleReviewedCases: number;
  pendingCases: number;
  averageClarity: number | null;
  averageRecognizability: number | null;
  meaningPreservationRate: number | null;
  fabricatedClaimCases: string[];
  disagreementCases: string[];
  professions: ProfessionQuality[];
  status: HumanQualityStatus;
  limitations: string[];
};

const mean = (values: number[]): number | null =>
  values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null;

/**
 * Validate a human-submitted record against benchmark IDs and existing submissions.
 * This verifies shape/uniqueness, NOT that an ID actually belongs to a human.
 * Actual reviewer identity and independence require a controlled review process.
 */
export function validateReviewSubmission(
  raw: ReviewSubmission,
  existing: readonly HumanReview[] = [],
  cases: readonly EvaluationCase[] = INTERVIEW_BENCHMARK_V1,
): HumanReview {
  summarizeHumanReviews(existing, cases);
  if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
      !cases.some(item => item.id === raw.caseId) ||
      typeof raw.reviewerId !== "string" || !/^[a-zA-Z0-9_-]{3,64}$/.test(raw.reviewerId) ||
      typeof raw.reviewedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.reviewedAt) ||
      !Number.isFinite(Date.parse(raw.reviewedAt)) ||
      typeof raw.clarity !== "number" || !Number.isInteger(raw.clarity) || raw.clarity < 1 || raw.clarity > 5 ||
      typeof raw.recognizability !== "number" || !Number.isInteger(raw.recognizability) ||
      raw.recognizability < 1 || raw.recognizability > 5 ||
      typeof raw.meaningPreserved !== "boolean" || typeof raw.fabricatedClaim !== "boolean" ||
      typeof raw.notes !== "string" || raw.notes.trim().length < 5 || raw.notes.length > 1000) {
    throw new Error("Invalid review submission");
  }
  if (existing.some(item => item.caseId === raw.caseId && item.reviewerId === raw.reviewerId)) {
    throw new Error("Duplicate reviewer");
  }
  const review: HumanReview = {
    caseId: raw.caseId,
    reviewerId: raw.reviewerId,
    reviewedAt: raw.reviewedAt,
    clarity: raw.clarity as HumanReview["clarity"],
    recognizability: raw.recognizability as HumanReview["recognizability"],
    meaningPreserved: raw.meaningPreserved,
    fabricatedClaim: raw.fabricatedClaim,
    notes: raw.notes.trim(),
  };
  summarizeHumanReviews([...existing, review], cases);
  return review;
}

/** Only double-reviewed cases contribute to quality metrics. Unreviewed scores stay null. */
export function buildHumanQualityReport(
  reviews: readonly HumanReview[] = [],
  cases: readonly EvaluationCase[] = INTERVIEW_BENCHMARK_V1,
): HumanQualityReport {
  const summary = summarizeHumanReviews(reviews, cases);
  const coverage = getInterviewCoverage(cases, reviews);
  const grouped = new Map<string, HumanReview[]>();
  for (const review of reviews) {
    const list = grouped.get(review.caseId) ?? [];
    list.push(review);
    grouped.set(review.caseId, list);
  }
  const completed = new Set([...grouped].filter(([, items]) => items.length >= 2).map(([id]) => id));
  const professions = OCCUPATIONAL_FAMILIES.map(family => {
    const familyCases = cases.filter(item => item.discipline === family.id);
    const familyIds = new Set(familyCases.map(item => item.id));
    const finishedIds = [...familyIds].filter(id => completed.has(id));
    const finishedReviews = finishedIds.flatMap(id => grouped.get(id) ?? []);
    return {
      discipline: family.id,
      label: family.label,
      priority: family.reviewPriority,
      totalCases: familyCases.length,
      doubleReviewedCases: finishedIds.length,
      pendingCases: familyCases.length - finishedIds.length,
      clarity: mean(finishedReviews.map(item => item.clarity)),
      recognizability: mean(finishedReviews.map(item => item.recognizability)),
      meaningPreservationRate: finishedReviews.length
        ? finishedReviews.filter(item => item.meaningPreserved).length / finishedReviews.length : null,
      flaggedFabrications: summary.fabricatedClaimCases.filter(id => familyIds.has(id)),
      disagreements: summary.disagreementCases.filter(id => familyIds.has(id)),
    };
  });
  const safetyFinding = summary.fabricatedClaimCases.length > 0 ||
    [...completed].some(id => (grouped.get(id) ?? []).some(item => !item.meaningPreserved));
  const needsAdjudication = summary.disagreementCases.length > 0;
  const status: HumanQualityStatus = safetyFinding ? "blocked-by-safety-finding"
    : needsAdjudication ? "needs-adjudication"
    : summary.casesPending > 0 || summary.averageClarity === null ||
      summary.averageRecognizability === null || summary.meaningPreservationRate === null ||
      summary.averageClarity < 4 || summary.averageRecognizability < 4 ||
      summary.meaningPreservationRate < 1 || coverage.unregisteredFixtureFamilies.length > 0
      ? "pending-human-review" : "ready-for-release-review";
  return {
    provenance: "independent-human-review-records",
    fixtureCount: cases.length,
    independentReviewRecords: reviews.length,
    doubleReviewedCases: summary.casesReviewedTwice,
    pendingCases: summary.casesPending,
    averageClarity: summary.averageClarity,
    averageRecognizability: summary.averageRecognizability,
    meaningPreservationRate: summary.meaningPreservationRate,
    fabricatedClaimCases: summary.fabricatedClaimCases,
    disagreementCases: summary.disagreementCases,
    professions,
    status,
    limitations: [
      "Review records must come from genuine independent humans; reviewer IDs alone do not prove identity.",
      "Synthetic fixtures cannot establish real-world reliability across professions.",
      "Release review requires adjudication, representative sampling, and professional sign-off.",
    ],
  };
}
