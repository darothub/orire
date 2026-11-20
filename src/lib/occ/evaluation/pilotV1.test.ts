import { describe, expect, it } from "vitest";
import { INTERVIEW_BENCHMARK_V1 } from "./fixtures";
import { createPilotV1Packet, getPilotV1Status, PILOT_V1_CASE_IDS } from "./pilotV1";
import type { HumanReview } from "./benchmark";

function humanStub(caseId: string, reviewerId: string, overrides: Partial<HumanReview> = {}): HumanReview {
  // These exist ONLY in a test; no claim that the reviewers exist.
  return {
    caseId, reviewerId, reviewedAt: "2026-11-20",
    clarity: 4, recognizability: 4, meaningPreserved: true,
    fabricatedClaim: false, notes: "Synthetic unit test only", ...overrides,
  };
}

describe("OCC 3.2.3 fixed small pilot", () => {
  it("selects exactly eight existing cases across four elevated-priority professions", () => {
    const packet = createPilotV1Packet();
    expect(packet).toHaveLength(8);
    expect(new Set(packet.map(item => item.caseId)).size).toBe(8);
    expect(new Set(packet.map(item => item.discipline))).toEqual(new Set(["medicine", "law", "agriculture", "nursing"]));
    expect(packet.every(item => INTERVIEW_BENCHMARK_V1.some(fixture => fixture.id === item.caseId))).toBe(true);
    for (const discipline of ["medicine", "law", "agriculture", "nursing"]) {
      expect(packet.filter(item => item.discipline === discipline)).toHaveLength(2);
    }
  });

  it("does not expose machine labels or synthetic risk in blinded packets", () => {
    for (const item of createPilotV1Packet()) {
      expect(Object.keys(item).sort()).toEqual(["caseId", "discipline", "question", "originalAnswer", "proposedRewrite"].sort());
      expect(item).not.toHaveProperty("expected");
      expect(item).not.toHaveProperty("risk");
    }
  });

  it("reports no fake reviews, scores or completion with the empty human dataset", () => {
    expect(getPilotV1Status()).toMatchObject({
      totalCases: 8, requiredIndependentReviews: 16, receivedRecords: 0,
      doubleReviewedCases: 0, pendingCases: 8,
      averageClarity: null, averageRecognizability: null,
      meaningPreservationRate: null, readyForFindings: false,
    });
  });

  it("requires two independent human records for every selected case", () => {
    const onePerCase = PILOT_V1_CASE_IDS.map(id => humanStub(id, "test-reviewer-one"));
    expect(getPilotV1Status(onePerCase).doubleReviewedCases).toBe(0);
    const full = [...onePerCase, ...PILOT_V1_CASE_IDS.map(id => humanStub(id, "test-reviewer-two"))];
    expect(getPilotV1Status(full)).toMatchObject({
      receivedRecords: 16, doubleReviewedCases: 8, pendingCases: 0, readyForFindings: true,
    });
    expect(() => getPilotV1Status([...onePerCase, onePerCase[0]])).toThrow("Duplicate reviewer");
  });

  it("blocks findings when human reviews disagree or flag unsupported claims", () => {
    const baseline = PILOT_V1_CASE_IDS.flatMap(id => [humanStub(id, "test-a"), humanStub(id, "test-b")]);
    const flagged = baseline.map((record, index) => index === 0 ? { ...record, fabricatedClaim: true, meaningPreserved: false } : record);
    expect(getPilotV1Status(flagged)).toMatchObject({
      readyForFindings: false, fabricatedClaimCases: [PILOT_V1_CASE_IDS[0]],
    });
    const conflict = baseline.map((record, index) => index === 0 ? { ...record, recognizability: 1 } : record);
    expect(getPilotV1Status(conflict).disagreementCases).toContain(PILOT_V1_CASE_IDS[0]);
    expect(getPilotV1Status(conflict).readyForFindings).toBe(false);
  });
});
