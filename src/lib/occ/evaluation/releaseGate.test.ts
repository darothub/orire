import { describe, expect, it } from "vitest";
import { OCC_RELEASE_DEFAULTS, evaluateOccRelease, type OccReleaseEvidence } from "./releaseGate";

describe("OCC M8.3 production release gate", () => {
  it("defaults to no launch despite completed engineering work", () => {
    const result = evaluateOccRelease(OCC_RELEASE_DEFAULTS);
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain("Independent double review of all benchmark cases is incomplete");
    expect(result.blockers).toContain("Authorized real-provider smoke test is missing");
    expect(result.blockers).toContain("Rollout does not have owner approval");
  });

  const allVerified: OccReleaseEvidence = {
    branchCiGreen: true, postMergeCiGreen: true,
    independentDoubleReviewedCases: 42, totalEvaluationCases: 42,
    unresolvedFabricatedClaims: 0, unresolvedMeaningChanges: 0,
    unresolvedReviewerDisagreements: 0,
    realProviderSmokePassed: true, entitlementAndFlagVerified: true,
    privacyAndRetentionApproved: true, operationalRollbackTested: true,
    ownerApprovedRollout: true,
  };

  it("requires independently verified evidence for every launch control", () => {
    expect(evaluateOccRelease(allVerified)).toEqual({ ready: true, blockers: [] });
    for (const key of [
      "branchCiGreen", "postMergeCiGreen", "realProviderSmokePassed",
      "entitlementAndFlagVerified", "privacyAndRetentionApproved",
      "operationalRollbackTested", "ownerApprovedRollout",
    ] as const) {
      const decision = evaluateOccRelease({ ...allVerified, [key]: false });
      expect(decision.ready, key).toBe(false);
      expect(decision.blockers.length).toBeGreaterThan(0);
    }
  });

  it("rejects missing human coverage and unresolved factuality issues", () => {
    expect(evaluateOccRelease({ ...allVerified, independentDoubleReviewedCases: 41 }).ready).toBe(false);
    expect(evaluateOccRelease({ ...allVerified, unresolvedFabricatedClaims: 1 }).ready).toBe(false);
    expect(evaluateOccRelease({ ...allVerified, unresolvedMeaningChanges: 1 }).ready).toBe(false);
    expect(evaluateOccRelease({ ...allVerified, unresolvedReviewerDisagreements: 1 }).ready).toBe(false);
    expect(evaluateOccRelease({ ...allVerified, unresolvedFabricatedClaims: -1 }).ready).toBe(false);
  });
});
