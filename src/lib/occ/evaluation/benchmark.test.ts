import { describe, expect, it } from "vitest";
import { evaluateInterviewBenchmark, summarizeHumanReviews, type HumanReview } from "./benchmark";
import { INTERVIEW_BENCHMARK_V1 } from "./fixtures";

describe("OCC profession-diverse interview benchmark v1 (synthetic)", () => {
  it("covers varied real-world disciplines and multiple hallucination risks", () => {
    const disciplines = new Set(INTERVIEW_BENCHMARK_V1.map(c => c.discipline));
    expect(disciplines.size).toBeGreaterThanOrEqual(8);
    expect(INTERVIEW_BENCHMARK_V1.length).toBeGreaterThanOrEqual(16);
    expect(INTERVIEW_BENCHMARK_V1.every(c => c.id && c.question && c.originalAnswer && c.proposedRewrite)).toBe(true);
    expect(new Set(INTERVIEW_BENCHMARK_V1.map(c => c.id)).size).toBe(INTERVIEW_BENCHMARK_V1.length);
    expect(INTERVIEW_BENCHMARK_V1.some(c => c.risk === "negation")).toBe(true);
    expect(INTERVIEW_BENCHMARK_V1.some(c => c.risk === "role-reversal")).toBe(true);
    expect(INTERVIEW_BENCHMARK_V1.some(c => c.risk === "quantity")).toBe(true);
  });

  it("blocks every synthetically unsafe claim; does not discard safe unchanged answers", () => {
    const result = evaluateInterviewBenchmark();
    // A single unblocked fabricated claim fails the safety gate.
    expect(result.falseAcceptances).toEqual([]);
    expect(result.unsafeRejected).toBe(result.unsafeTotal);
    expect(result.falseRejections).toEqual([]);
    expect(result.safeAccepted).toBe(result.safeTotal);
    expect(result.professions).toHaveLength(8);
  });

  it("reports pending human review honestly rather than fabricating a quality score", () => {
    expect(summarizeHumanReviews([])).toMatchObject({
      casesReviewedTwice: 0,
      casesPending: INTERVIEW_BENCHMARK_V1.length,
      disagreementCases: [],
      fabricatedClaimCases: [],
      averageClarity: null,
      averageRecognizability: null,
      meaningPreservationRate: null,
    });
  });

  it("requires two independent reviewers and flags disagreements", () => {
    const caseId = INTERVIEW_BENCHMARK_V1[0].id;
    // Test-only stub reviews, never stored as human benchmark evidence.
    const sample: HumanReview[] = [
      { caseId, reviewerId: "reviewer-test-a", reviewedAt: "2026-11-15", clarity: 5,
        recognizability: 5, meaningPreserved: true, fabricatedClaim: false, notes: "test stub" },
      { caseId, reviewerId: "reviewer-test-b", reviewedAt: "2026-11-15", clarity: 4,
        recognizability: 2, meaningPreserved: false, fabricatedClaim: true, notes: "test stub" },
    ];
    expect(summarizeHumanReviews(sample)).toMatchObject({
      casesReviewedTwice: 1,
      casesPending: INTERVIEW_BENCHMARK_V1.length - 1,
      disagreementCases: [caseId],
      fabricatedClaimCases: [caseId],
      averageClarity: 4.5,
      averageRecognizability: 3.5,
      meaningPreservationRate: 0.5,
    });
    expect(summarizeHumanReviews(sample.slice(0, 1)).casesReviewedTwice).toBe(0);
    expect(() => summarizeHumanReviews([...sample, sample[0]])).toThrow("Duplicate reviewer");
    expect(() => summarizeHumanReviews([{ ...sample[0], caseId: "made-up" }])).toThrow("Unknown review case");
  });
});
