import { describe, expect, it } from "vitest";
import { INTERVIEW_BENCHMARK_V1 } from "./fixtures";
import { makeBlindInterviewReviewPacket, reviewReadinessSummary } from "./reviewerPacket";

describe("OCC M8.1 blinded human evaluation preparation", () => {
  it("produces a complete review packet without leaking oracle labels or risk classifications", () => {
    const items = makeBlindInterviewReviewPacket();
    expect(items).toHaveLength(INTERVIEW_BENCHMARK_V1.length);
    expect(new Set(items.map(item => item.caseId)).size).toBe(items.length);
    for (const item of items) {
      expect(item.candidateAnswer).toBeTruthy();
      expect(item.suggestedWording).toBeTruthy();
      expect(item).not.toHaveProperty("expected");
      expect(item).not.toHaveProperty("risk");
      expect(item.clarity).toBeNull();
      expect(item.recognizability).toBeNull();
      expect(item.meaningPreserved).toBeNull();
      expect(item.fabricatedClaim).toBeNull();
      expect(item.notes).toBe("");
    }
  });

  it("fails closed for duplicate or incomplete review cases", () => {
    const original = INTERVIEW_BENCHMARK_V1[0];
    expect(() => makeBlindInterviewReviewPacket([original, original])).toThrow("unique IDs");
    expect(() => makeBlindInterviewReviewPacket([{ ...original, proposedRewrite: "" }])).toThrow();
  });

  it("reports pending human assessments and elevated-risk families without inventing human scores", () => {
    const summary = reviewReadinessSummary();
    expect(summary.syntheticCases).toBe(42);
    expect(summary.families).toBe(20);
    expect(summary.minimumIndependentAssessments).toBe(84);
    expect(summary.humanReviewStatus).toBe("pending");
    expect(summary.humanReviewsComplete).toBe(0);
    expect(summary.elevatedFamilies).toContain("medicine");
    expect(summary.elevatedFamilies).toContain("law");
    expect(summary.elevatedFamilies).toContain("agriculture");
  });
});
