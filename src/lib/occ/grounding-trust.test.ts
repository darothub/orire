import { describe, expect, it } from "vitest";
import { parseGroundedAdvice } from "./recommendations";
import { parseInterviewFeedback } from "./interview";

const cv = "Professional Summary: Experienced teacher. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education.";

function advice(recommendations: Array<Record<string, unknown>>) {
  return JSON.stringify({ summary: "Review", recommendations, nextSteps: [] });
}

describe("OCC 3.1.4 evidence grounding", () => {
  it("only labels recommendations supported when evidence occurs in the submitted CV", () => {
    const result = parseGroundedAdvice(advice([
      { requirement: "Teaching", cvEvidence: "Teaching mathematics to secondary school students", assessment: "supported",
        suggestion: "Clarify what you did.", sampleWording: null, question: null },
      { requirement: "Performance metrics", cvEvidence: "Increased student scores by 40%", assessment: "supported",
        suggestion: "Only add a real number.", sampleWording: "Increased student scores by 40%", question: "Do you have verified outcomes?" },
    ]), cv);
    expect(result.recommendations[0].assessment).toBe("supported");
    expect(result.recommendations[0].cvEvidence).toBe("Teaching mathematics to secondary school students");
    expect(result.recommendations[1].assessment).toBe("needs-clarification");
    expect(result.recommendations[1].cvEvidence).toBeNull();
    expect(result.recommendations[1].sampleWording).toBeNull();
  });

  it("rejects an unsupported metric in suggested CV wording", () => {
    const result = parseGroundedAdvice(advice([
      { requirement: "Experience", cvEvidence: "Teaching mathematics to secondary school students", assessment: "supported",
        suggestion: "Describe your work clearly.", sampleWording: "Teaching mathematics to 500 secondary school students", question: null },
    ]), cv);
    expect(result.recommendations[0].assessment).toBe("supported");
    expect(result.recommendations[0].sampleWording).toBeNull();
  });

  it("does not show an invented interview achievement as the candidate's wording", () => {
    const answer = "I explained mathematics using a classroom example and gave students practice.";
    const result = parseInterviewFeedback(JSON.stringify({
      strength: "You gave a classroom example.", improvement: "Add your real outcome.",
      example: "An optional outline.", followUp: "How did you check understanding?",
      betterWording: "I improved mathematics results by 40% using a classroom example.",
      whyBetter: "It sounds more impressive.",
    }), answer);
    expect(result.wordingStatus).toBe("copyedit");
    expect(result.betterWording).toBe(answer);
    expect(result.betterWording).not.toContain("40%");
  });
});
