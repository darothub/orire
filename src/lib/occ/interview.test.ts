import { describe, expect, it } from "vitest";
import { INTERVIEW_TOPICS, MAX_INTERVIEW_TURNS, parseInterviewFeedback, parseInterviewQuestion } from "./interview";

describe("OCC mock interview schema", () => {
  it("bounds session length and focus topics", () => {
    expect(MAX_INTERVIEW_TURNS).toBe(5);
    expect(INTERVIEW_TOPICS).toHaveLength(MAX_INTERVIEW_TURNS);
  });
  it("accepts only structured questions", () => {
    expect(parseInterviewQuestion(JSON.stringify({ question: "How would you design a secure payment API?", focus: "API security" }))).toMatchObject({
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
  it("provides two general answer starters without invented candidate claims", () => {
    const result = parseInterviewQuestion(JSON.stringify({
      question: "How would you help a patient who feels worried before a procedure?",
      focus: "Patient care",
      answerStarters: ["I would explain the procedure in clear terms and invite questions.", "I would first listen to the patient and check what they are worried about."],
    }));
    expect(result.answerStarters).toHaveLength(2);
    expect(result.answerStarters?.[0]).toContain("procedure");
  });
  it("rejects invented numbers in rephrased answers", () => {
    const raw = JSON.stringify({
      strength: "You explained the process.", improvement: "Give a clear example.",
      followUp: "What would you do next?", betterWording: "I improved results by 50% through careful planning.",
      whyBetter: "It sounds more specific.",
    });
    expect(parseInterviewFeedback(raw, "I planned the work and helped people.").betterWording).toBe("");
    expect(parseInterviewFeedback(raw, "I improved results by 50% through careful planning.").betterWording).toContain("50%");
  });
  it("removes unexpected fields and caps untrusted text", () => {
    const data = parseInterviewFeedback(JSON.stringify({
      strength: "A".repeat(500), improvement: "B", example: "", followUp: "C", score: 100,
    }));
    expect(data.strength).toHaveLength(400);
    expect(data).not.toHaveProperty("score");
  });
});
