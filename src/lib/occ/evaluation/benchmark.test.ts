import { describe, expect, it } from "vitest";
import { evaluateInterviewBenchmark, summarizeHumanReviews, type HumanReview } from "./benchmark";
import { INTERVIEW_BENCHMARK_V1 } from "./fixtures";
import humanReviewRecords from "./human-reviews.json";
import { buildHumanQualityReport } from "./humanQuality";
import { getInterviewCoverage, OCCUPATIONAL_FAMILIES, NOT_YET_SAMPLED_FAMILIES } from "./coverage";

describe("OCC profession-diverse interview benchmark v1 (synthetic)", () => {
  it("covers varied real-world disciplines and multiple hallucination risks", () => {
    const disciplines = new Set(INTERVIEW_BENCHMARK_V1.map(c => c.discipline));
    expect(disciplines.size).toBeGreaterThanOrEqual(20);
    expect(INTERVIEW_BENCHMARK_V1.length).toBeGreaterThanOrEqual(42);
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
    expect(result.professions).toHaveLength(20);
  });

  it("reports the versioned benchmark without making AI calls or fabricating human scores", () => {
    const machine = evaluateInterviewBenchmark();
    const human = summarizeHumanReviews(humanReviewRecords as HumanReview[]);
    const coverage = getInterviewCoverage(INTERVIEW_BENCHMARK_V1, humanReviewRecords as HumanReview[]);
    console.info("[OCC INTERVIEW BENCHMARK v1]", JSON.stringify({
      fixtureCount: machine.fixtureCount,
      professions: machine.professions,
      unsafeRejected: machine.unsafeRejected,
      unsafeTotal: machine.unsafeTotal,
      safeAccepted: machine.safeAccepted,
      safeTotal: machine.safeTotal,
      falseAcceptances: machine.falseAcceptances,
      falseRejections: machine.falseRejections,
      humanReview: human,
      humanQuality: buildHumanQualityReport(humanReviewRecords as HumanReview[]),
      coverage: {
        families: coverage.sampled.length,
        syntheticOnly: coverage.sampled.filter(x => x.status === "synthetic-only").map(x => x.id),
        elevatedPriority: coverage.sampled.filter(x => x.priority === "elevated").map(x => x.id),
        notSampled: coverage.explicitlyNotSampled,
        unregistered: coverage.unregisteredFixtureFamilies,
      },
    }));
    expect(human.casesPending + human.casesReviewedTwice).toBe(machine.fixtureCount);
    expect(buildHumanQualityReport(humanReviewRecords as HumanReview[]).fixtureCount).toBe(machine.fixtureCount);
    // Human-review completion is measured and reported separately, not mocked.
  });

  it("reports 20 family categories with explicit evaluation gaps", () => {
    const report = getInterviewCoverage();
    expect(OCCUPATIONAL_FAMILIES).toHaveLength(20);
    expect(report.sampled).toHaveLength(20);
    expect(report.sampled.every(x => x.syntheticCases >= 2 && x.safeCases >= 1 && x.unsafeCases >= 1)).toBe(true);
    expect(report.sampled.every(x => x.status === "synthetic-only" && x.doubleReviewedCases === 0)).toBe(true);
    expect(report.sampled.filter(x => x.priority === "elevated").map(x => x.id)).toContain("medicine");
    expect(report.sampled.filter(x => x.priority === "elevated").map(x => x.id)).toContain("law");
    expect(report.sampled.filter(x => x.priority === "elevated").map(x => x.id)).toContain("agriculture");
    expect(report.explicitlyNotSampled).toEqual([...NOT_YET_SAMPLED_FAMILIES]);
    expect(report.unregisteredFixtureFamilies).toEqual([]);
    expect(report.explicitlyNotSampled).toContain("veterinary-medicine");
    expect(report.explicitlyNotSampled).toContain("aviation");
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
