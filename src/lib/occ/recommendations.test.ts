import { describe, expect, it } from "vitest";
import { parseGroundedAdvice } from "./recommendations";

const cv = "Built Kotlin applications and deployed services with Kafka on AWS.";
const response = (overrides: Record<string, unknown> = {}) => JSON.stringify({
  summary: "Candidate matches part of the role.",
  nextSteps: ["Ask about Kubernetes experience"],
  recommendations: [{
    requirement: "Kotlin",
    cvEvidence: "Built Kotlin applications",
    assessment: "supported",
    suggestion: "Emphasize this existing experience.",
    question: null,
  }],
  ...overrides,
});
describe("OCC grounded agent output", () => {
  it("retains only literal CV evidence", () => {
    const result = parseGroundedAdvice(response(), cv);
    expect(result.recommendations[0].assessment).toBe("supported");
    expect(result.recommendations[0].cvEvidence).toBe("Built Kotlin applications");
  });
  it("downgrades fabricated evidence", () => {
    const result = parseGroundedAdvice(response({
      recommendations: [{ requirement: "Kubernetes", cvEvidence: "Led Kubernetes migrations across 60 teams", assessment: "supported", suggestion: "Ask for supporting evidence" }],
    }), cv);
    expect(result.recommendations[0].assessment).toBe("needs-clarification");
    expect(result.recommendations[0].cvEvidence).toBeNull();
  });
  it("rejects malformed or empty completions", () => {
    expect(() => parseGroundedAdvice("not json", cv)).toThrow();
    expect(() => parseGroundedAdvice('{"recommendations":[]}', cv)).toThrow();
  });
  it("bounds recommendation count", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      requirement: "skill" + i, suggestion: "Check your evidence", assessment: "not-found",
    }));
    expect(parseGroundedAdvice(response({ recommendations: many }), cv).recommendations).toHaveLength(6);
  });
});
