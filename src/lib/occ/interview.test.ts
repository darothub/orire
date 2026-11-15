import { describe, expect, it } from "vitest";
import { INTERVIEW_TOPICS, MAX_INTERVIEW_TURNS, parseInterviewFeedback, parseInterviewQuestion } from "./interview";

describe("OCC mock interview schema", () => {
  it("bounds session length and focus topics", () => {
    expect(MAX_INTERVIEW_TURNS).toBe(5);
    expect(INTERVIEW_TOPICS).toHaveLength(MAX_INTERVIEW_TURNS);
  });
  it("accepts only structured questions", () => {
    expect(parseInterviewQuestion(JSON.stringify({ question: "How would you design a secure payment API?", focus: "API security" }))).toEqual({
      question: "How would you design a secure payment API?", focus: "API security",
    });
    expect(() => parseInterviewQuestion("not json")).toThrow();
    expect(() => parseInterviewQuestion(JSON.stringify({ question: "Hello?", focus: "?" }))).toThrow();
  });
  it("validates constructive feedback and optional illustrative examples", () => {
    expect(parseInterviewFeedback(JSON.stringify({
      strength: "You described a clear retry boundary.",
      improvement: "Clarify idempotency handling.",
      example: "An illustrative outline could mention an idempotency key.",
      followUp: "How would you monitor duplicate requests?",
    }))).toMatchObject({ improvement: "Clarify idempotency handling." });
    expect(() => parseInterviewFeedback(JSON.stringify({ strength: "Great", improvement: "Add detail" }))).toThrow();
  });
  it("removes unexpected fields and caps untrusted text", () => {
    const data = parseInterviewFeedback(JSON.stringify({
      strength: "A".repeat(500), improvement: "B", example: "", followUp: "C", score: 100,
    }));
    expect(data.strength).toHaveLength(400);
    expect(data).not.toHaveProperty("score");
  });
});
