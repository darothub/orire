import { describe, expect, it } from "vitest";
import { validateOccCoachingHistory } from "./coachingHistory";

const review = {
  kind: "review", summary: "Grounded summary.",
  recommendations: [{
    requirement: "Public health communication", assessment: "supported",
    cvEvidence: "Coordinated community health education",
    suggestion: "Clarify which outreach activities you completed.",
    sampleWording: null, question: null,
  }],
  nextSteps: ["Check all CV excerpts."],
  disclaimer: "User-reported evidence is not externally verified.",
};
const interview = {
  kind: "interview",
  question: "Describe how you handled a challenging situation.",
  focus: "Patient communication",
  answer: "I explained the care plan to my supervisor.",
  strength: "Clear description.",
  improvement: "Explain the challenge with a specific, true example.",
  followUp: "What was the outcome?",
  betterWording: "I explained the care plan to my supervisor.",
  disclaimer: "Practice only, not a hiring prediction.",
};
const valid = { consent: true, snapshots: [{ messageSequence: 1, payload: review }] };

describe("OCC P6B consented coaching-history contract", () => {
  it("requires independent affirmative consent and rejects hidden fields", () => {
    expect(validateOccCoachingHistory({ ...valid, consent: false })).toBeNull();
    expect(validateOccCoachingHistory({ snapshots: valid.snapshots })).toBeNull();
    expect(validateOccCoachingHistory({ ...valid, documentText: "secret full CV" })).toBeNull();
    expect(validateOccCoachingHistory({ consent: true, snapshots: [
      { messageSequence: 1, payload: { ...review, jobDescription: "secret" } },
    ] })).toBeNull();
  });
  it("accepts bounded, version-1-compatible profession-diverse snapshots", () => {
    const x = validateOccCoachingHistory({ consent: true, snapshots: [
      { messageSequence: 1, payload: review },
      { messageSequence: 3, payload: interview },
    ] });
    expect(x?.snapshots).toHaveLength(2);
    expect(x?.snapshots[1].kind).toBe("interview");
  });
  it("rejects duplicate, negative, fractional or excessive sequence indexes", () => {
    expect(validateOccCoachingHistory({ consent: true, snapshots: [
      { messageSequence: 1, payload: review }, { messageSequence: 1, payload: review },
    ] })).toBeNull();
    for (const index of [-1, 100, 2.5, Number.MAX_VALUE * 2]) {
      expect(validateOccCoachingHistory({ consent: true, snapshots: [
        { messageSequence: index, payload: review },
      ] })).toBeNull();
    }
    expect(validateOccCoachingHistory({ consent: true, snapshots: Array.from({ length: 41 }, (_, i) => ({
      messageSequence: i, payload: review,
    })) })).toBeNull();
  });
  it("rejects ungrounded supported review records and excessive interview answers", () => {
    expect(validateOccCoachingHistory({ consent: true, snapshots: [{
      messageSequence: 1, payload: { ...review, recommendations: [{ ...review.recommendations[0], cvEvidence: null }] },
    }] })).toBeNull();
    expect(validateOccCoachingHistory({ consent: true, snapshots: [{
      messageSequence: 1, payload: { ...interview, answer: "X".repeat(4001) },
    }] })).toBeNull();
  });
});
