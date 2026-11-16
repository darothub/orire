import { describe, expect, it } from "vitest";
import { validateOccCoachingSnapshot } from "./coachingSnapshot";

const review = {
  kind: "review", summary: "Evidence-based role review.",
  recommendations: [{
    requirement: "Java payments", assessment: "supported",
    cvEvidence: "Built Java payment services",
    suggestion: "Emphasize documented work.", sampleWording: "Built Java payment services",
    question: null,
  }],
  nextSteps: ["Verify all statements."],
  disclaimer: "CV claims are self-reported, not independently verified.",
};
const interview = {
  kind: "interview", question: "How do you handle conflicting stakeholder requirements?",
  focus: "Collaboration", answer: "I gather the requirements and discuss the tradeoffs.",
  strength: "Clear initial approach.", improvement: "Give a real example.",
  followUp: "How did you resolve a specific conflict?", betterWording: null,
  disclaimer: "Practice feedback, not a hiring prediction.",
};
describe("OCC P6A coaching snapshot contract", () => {
  it("never accepts data without affirmative consent", () => {
    expect(validateOccCoachingSnapshot(review, false)).toBeNull();
    expect(validateOccCoachingSnapshot(interview, false)).toBeNull();
    expect(validateOccCoachingSnapshot(review, true)).toEqual(review);
    expect(validateOccCoachingSnapshot(interview, true)).toEqual(interview);
  });
  it("rejects hidden raw documents, provider messages and unknown fields", () => {
    expect(validateOccCoachingSnapshot({ ...review, cv: "uploaded private CV" }, true)).toBeNull();
    expect(validateOccCoachingSnapshot({ ...review, jobDescription: "private JD" }, true)).toBeNull();
    expect(validateOccCoachingSnapshot({ ...interview, systemPrompt: "secret" }, true)).toBeNull();
    expect(validateOccCoachingSnapshot({ ...review, recommendations: [
      { ...review.recommendations[0], rawProviderResponse: "untrusted" },
    ] }, true)).toBeNull();
  });
  it("rejects unsupported samples, fabricated assessment statuses and oversized answers", () => {
    expect(validateOccCoachingSnapshot({ ...review, recommendations: [
      { ...review.recommendations[0], assessment: "not-found" },
    ] }, true)).toBeNull();
    expect(validateOccCoachingSnapshot({ ...review, recommendations: [
      { ...review.recommendations[0], assessment: "verified" },
    ] }, true)).toBeNull();
    expect(validateOccCoachingSnapshot({ ...interview, answer: "X".repeat(4001) }, true)).toBeNull();
    expect(validateOccCoachingSnapshot({ ...review, recommendations: Array(7).fill(review.recommendations[0]) }, true)).toBeNull();
  });
  it("rejects missing quotes for allegedly supported claims", () => {
    expect(validateOccCoachingSnapshot({ ...review, recommendations: [
      { ...review.recommendations[0], cvEvidence: null },
    ] }, true)).toBeNull();
  });
  it("does not perform storage operations; the contract cannot verify quoted claims", () => {
    const unverified = { ...review, recommendations: [
      { ...review.recommendations[0], cvEvidence: "Candidate claims 80% success", sampleWording: null },
    ] };
    expect(validateOccCoachingSnapshot(unverified, true)).toEqual(unverified);
  });
});
