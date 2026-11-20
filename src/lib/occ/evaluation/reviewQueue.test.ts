import { describe, expect, it } from "vitest";
import { INTERVIEW_BENCHMARK_V1 } from "./fixtures";
import { createBlindReviewPacket, createPriorityReviewPacket, getHumanReviewQueue } from "./reviewQueue";
import type { HumanReview } from "./benchmark";

describe("OCC 3.2 independent human-review preparation", () => {
  const review = (caseId: string, reviewerId: string): HumanReview => ({
    caseId, reviewerId, reviewedAt: "2026-11-20",
    clarity: 4, recognizability: 4, meaningPreserved: true,
    fabricatedClaim: false, notes: "Independent review",
  });

  it("never exposes machine labels or risk classification to a reviewer", () => {
    const packet = createPriorityReviewPacket();
    expect(packet).toHaveLength(12);
    for (const item of packet) {
      expect(item.originalAnswer).toBeTruthy();
      expect(item.proposedRewrite).toBeTruthy();
      expect(Object.keys(item).sort()).toEqual(
        ["caseId", "discipline", "question", "originalAnswer", "proposedRewrite"].sort(),
      );
      expect(item).not.toHaveProperty("expected");
      expect(item).not.toHaveProperty("risk");
    }
  });

  it("prioritizes elevated-risk professions without claiming they were human reviewed", () => {
    const queue = getHumanReviewQueue();
    expect(queue).toHaveLength(INTERVIEW_BENCHMARK_V1.length);
    expect(queue.every(item => item.completedIndependentReviews === 0 && item.reviewsRemaining === 2)).toBe(true);
    expect(queue.slice(0, 12).every(item => item.priority === "elevated")).toBe(true);
  });

  it("does not close a case until two distinct independent reviews are recorded", () => {
    const caseId = INTERVIEW_BENCHMARK_V1[0].id;
    const first = getHumanReviewQueue(INTERVIEW_BENCHMARK_V1, [review(caseId, "reviewer-a")]);
    expect(first.find(item => item.caseId === caseId)).toMatchObject({
      completedIndependentReviews: 1, reviewsRemaining: 1,
    });
    const complete = getHumanReviewQueue(INTERVIEW_BENCHMARK_V1,
      [review(caseId, "reviewer-a"), review(caseId, "reviewer-b")]);
    expect(complete.find(item => item.caseId === caseId)).toBeUndefined();
    expect(complete).toHaveLength(INTERVIEW_BENCHMARK_V1.length - 1);
  });

  it("rejects duplicate and unknown cases rather than silently issuing invalid packets", () => {
    const caseId = INTERVIEW_BENCHMARK_V1[0].id;
    expect(() => createBlindReviewPacket([caseId, caseId])).toThrow("Duplicate packet case");
    expect(() => createBlindReviewPacket(["missing-case"])).toThrow("Unknown packet case");
    expect(() => createPriorityReviewPacket(0)).toThrow("Invalid packet size");
  });

  it("rejects duplicate reviewer records rather than treating them as independent", () => {
    const caseId = INTERVIEW_BENCHMARK_V1[0].id;
    expect(() => getHumanReviewQueue(INTERVIEW_BENCHMARK_V1,
      [review(caseId, "reviewer-a"), review(caseId, "reviewer-a")])).toThrow("Duplicate reviewer");
  });
});
