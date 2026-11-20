import { describe, expect, it } from "vitest";
import { INTERVIEW_BENCHMARK_V1 } from "./fixtures";
import { buildHumanQualityReport, validateReviewSubmission, type ReviewSubmission } from "./humanQuality";
import type { HumanReview } from "./benchmark";

const caseId = INTERVIEW_BENCHMARK_V1[0].id;
function submission(reviewerId: string, overrides: Partial<ReviewSubmission> = {}): ReviewSubmission {
  return {
    caseId, reviewerId, reviewedAt: "2026-11-20", clarity: 5, recognizability: 5,
    meaningPreserved: true, fabricatedClaim: false, notes: "Retains the original meaning.",
    ...overrides,
  };
}
function review(reviewerId: string, overrides: Partial<ReviewSubmission> = {}): HumanReview {
  return validateReviewSubmission(submission(reviewerId, overrides));
}
describe("OCC 3.2.2 human review intake and quality reporting", () => {
  it("reports the real empty dataset as pending with no fabricated scores", () => {
    const report = buildHumanQualityReport([]);
    expect(report).toMatchObject({
      fixtureCount: INTERVIEW_BENCHMARK_V1.length,
      independentReviewRecords: 0,
      doubleReviewedCases: 0,
      pendingCases: INTERVIEW_BENCHMARK_V1.length,
      averageClarity: null,
      averageRecognizability: null,
      meaningPreservationRate: null,
      status: "pending-human-review",
    });
    expect(report.professions).toHaveLength(20);
    expect(report.professions.every(item => item.doubleReviewedCases === 0 &&
      item.clarity === null && item.recognizability === null)).toBe(true);
  });

  it("validates shape, benchmark IDs, scores, dates and reviewer independence", () => {
    const first = validateReviewSubmission(submission("human-a"));
    expect(first.notes).toBe("Retains the original meaning.");
    expect(() => validateReviewSubmission(submission("human-a"), [first])).toThrow("Duplicate reviewer");
    expect(() => validateReviewSubmission(submission("human-b", { caseId: "unknown-case" }))).toThrow("Invalid review submission");
    expect(() => validateReviewSubmission(submission("human-b", { clarity: 6 }))).toThrow("Invalid review submission");
    expect(() => validateReviewSubmission(submission("human-b", { recognizability: 0 }))).toThrow("Invalid review submission");
    expect(() => validateReviewSubmission(submission("human-b", { reviewedAt: "not-a-date" }))).toThrow("Invalid review submission");
    expect(() => validateReviewSubmission(submission("human-b", { notes: "  " }))).toThrow("Invalid review submission");
  });

  it("does not include one-review cases in quality metrics", () => {
    const report = buildHumanQualityReport([review("human-a")]);
    expect(report.independentReviewRecords).toBe(1);
    expect(report.doubleReviewedCases).toBe(0);
    expect(report.averageClarity).toBeNull();
    expect(report.pendingCases).toBe(INTERVIEW_BENCHMARK_V1.length);
  });

  it("counts only completed double reviews in aggregate and profession metrics", () => {
    const report = buildHumanQualityReport([
      review("human-a", { clarity: 5, recognizability: 4 }),
      review("human-b", { clarity: 3, recognizability: 5 }),
    ]);
    expect(report.doubleReviewedCases).toBe(1);
    expect(report.averageClarity).toBe(4);
    expect(report.averageRecognizability).toBe(4.5);
    expect(report.meaningPreservationRate).toBe(1);
    expect(report.status).toBe("pending-human-review");
    const family = report.professions.find(item => item.discipline === "nursing");
    expect(family).toMatchObject({ doubleReviewedCases: 1, clarity: 4, recognizability: 4.5 });
  });

  it("blocks flagged fabrications or meaning changes even when other scores are high", () => {
    const report = buildHumanQualityReport([
      review("human-a", { fabricatedClaim: true, meaningPreserved: false }),
      review("human-b"),
    ]);
    expect(report.status).toBe("blocked-by-safety-finding");
    expect(report.fabricatedClaimCases).toContain(caseId);
    expect(report.disagreementCases).toContain(caseId);
    expect(report.professions.find(item => item.discipline === "nursing")?.flaggedFabrications).toContain(caseId);
  });

  it("separately flags disagreements with no observed fabricated claim", () => {
    const report = buildHumanQualityReport([
      review("human-a", { recognizability: 2 }),
      review("human-b", { recognizability: 5 }),
    ]);
    expect(report.status).toBe("needs-adjudication");
    expect(report.disagreementCases).toEqual([caseId]);
    expect(report.fabricatedClaimCases).toEqual([]);
  });

  it("does not let partial or invalid review data become release-ready", () => {
    const allSingle = INTERVIEW_BENCHMARK_V1.map(item =>
      review("human-a", { caseId: item.id }));
    expect(buildHumanQualityReport(allSingle).status).toBe("pending-human-review");
    expect(buildHumanQualityReport(allSingle).doubleReviewedCases).toBe(0);
    expect(() => buildHumanQualityReport([review("human-a"), review("human-a")])).toThrow("Duplicate reviewer");
  });
});
