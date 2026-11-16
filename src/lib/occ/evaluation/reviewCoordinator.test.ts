import { describe, expect, it } from "vitest";
import { coordinateHumanInterviewReviews } from "./reviewCoordinator";
import { INTERVIEW_BENCHMARK_V1 } from "./fixtures";
import type { HumanReview } from "./benchmark";

describe("OCC M8.5 coordination (no fabricated human evidence)", () => {
  it("reports the real outstanding 84 reviews without inventing scores", () => {
    const result = coordinateHumanInterviewReviews([]);
    expect(result.benchmarkCases).toBe(42);
    expect(result.requiredAssessments).toBe(84);
    expect(result.independentAssessmentsRecorded).toBe(0);
    expect(result.outstandingAssessments).toBe(84);
    expect(result.casesDoubleReviewed).toBe(0);
    expect(result.casesNeedingSecondReview).toBe(42);
    expect(result.disagreementCases).toEqual([]);
    expect(result.fabricatedClaimCases).toEqual([]);
    expect(Object.keys(result.byProfession)).toHaveLength(20);
  });
  it("counts partial coverage accurately without pretending a case is double reviewed", () => {
    const first = INTERVIEW_BENCHMARK_V1[0];
    const sample: HumanReview = {
      caseId: first.id, reviewerId: "test-only-not-a-real-person",
      reviewedAt: "2026-11-15", clarity: 4, recognizability: 4,
      meaningPreserved: true, fabricatedClaim: false, notes: "test stub",
    };
    const partial = coordinateHumanInterviewReviews([sample]);
    expect(partial.outstandingAssessments).toBe(83);
    expect(partial.casesDoubleReviewed).toBe(0);
    expect(partial.casesNeedingSecondReview).toBe(42);
    const complete = coordinateHumanInterviewReviews([sample, { ...sample, reviewerId: "independent-test-stub" }]);
    expect(complete.outstandingAssessments).toBe(82);
    expect(complete.casesDoubleReviewed).toBe(1);
    expect(complete.casesNeedingSecondReview).toBe(41);
  });
  it("fails for duplicate reviewer records rather than crediting a second human", () => {
    const sample: HumanReview = {
      caseId: INTERVIEW_BENCHMARK_V1[0].id, reviewerId: "same-test-stub",
      reviewedAt: "2026-11-15", clarity: 4, recognizability: 4,
      meaningPreserved: true, fabricatedClaim: false, notes: "test stub",
    };
    expect(() => coordinateHumanInterviewReviews([sample, sample])).toThrow("Duplicate reviewer");
  });
});
