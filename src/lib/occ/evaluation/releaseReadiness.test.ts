import { describe, expect, it } from "vitest";
import { INTERVIEW_BENCHMARK_V1 } from "./fixtures";
import { assessM8ReleaseReadiness, NO_RELEASE_ATTESTATIONS } from "./releaseReadiness";

describe("OCC M8.3 fail-closed release readiness", () => {
  it("blocks rollout with zero genuine human reviews even if the synthetic benchmark exists", () => {
    const status = assessM8ReleaseReadiness([]);
    expect(status.approved).toBe(false);
    expect(status.benchmarkCases).toBe(42);
    expect(status.doubleReviewedCases).toBe(0);
    expect(status.outstandingAssessments).toBe(84);
    expect(status.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining("Independent double review incomplete"),
      expect.stringContaining("Authorized live-provider smoke"),
      expect.stringContaining("Independent human review provenance"),
    ]));
  });

  it("never counts repeated reviewer IDs as independent assessments", () => {
    const one = {
      caseId: INTERVIEW_BENCHMARK_V1[0].id,
      reviewerId: "reviewer-a",
      reviewedAt: "2026-11-15T00:00:00Z",
      clarity: 5 as const,
      recognizability: 5 as const,
      meaningPreserved: true,
      fabricatedClaim: false,
      notes: "synthetic unit-test-only review",
    };
    expect(() => assessM8ReleaseReadiness([one, one])).toThrow("Duplicate reviewer");
  });

  it("does not permit caller-provided attestations to bypass missing case reviews", () => {
    const allAttested = Object.fromEntries(
      Object.keys(NO_RELEASE_ATTESTATIONS).map(key => [key, true]),
    ) as unknown as typeof NO_RELEASE_ATTESTATIONS;
    const status = assessM8ReleaseReadiness([], allAttested);
    expect(status.approved).toBe(false);
    expect(status.outstandingAssessments).toBe(84);
  });

  it("blocks an empty evaluation set even with manually supplied attestations", () => {
    expect(assessM8ReleaseReadiness([], NO_RELEASE_ATTESTATIONS, []).blockers)
      .toContain("No benchmark cases supplied");
  });
});
