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
      answerStarters: ["Discuss how you would explain the procedure in clear terms and invite questions.", "Consider listening to the patient and checking what they are worried about."],
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
    expect(parseInterviewFeedback(raw, "I planned the work and helped people.").betterWording).toBe("I planned the work and helped people.");
    expect(parseInterviewFeedback(raw, "I improved results by 50% through careful planning.").betterWording).toContain("50%");
  });
  it.each([
    ["nursing", "I listened to the patient and explained the procedure.", "I gave medication to the patient and explained the procedure."],
    ["teaching", "I explained the lesson and helped students understand.", "I increased exam results and helped students understand."],
    ["accounting", "I checked invoices and explained the expenses.", "I audited the accounts and explained the expenses."],
    ["administration", "I organized meetings and answered calls.", "I managed the entire office and answered calls."],
    ["hospitality", "I welcomed guests and helped with reservations.", "I managed a luxury hotel and helped with reservations."],
    ["engineering", "I tested the service and reviewed the logs.", "I designed a new architecture and reviewed the logs."],
  ])("protects %s from invented work experience", (_field, original, fabricated) => {
    const raw = JSON.stringify({ strength: "You explained your approach.", improvement: "Share your real example.",
      followUp: "What did you learn?", betterWording: fabricated,
      whyBetter: "It gives more detail." });
    const result = parseInterviewFeedback(raw, original);
    expect(result.betterWording).toBe(original);
    expect(result.whyBetter).toContain("your own experience");
    expect(result.wordingStatus).toBe("copyedit");
  });
  it("preserves truth when wording only changes presentation", () => {
    const original = "i listened to the patient and explained the procedure";
    const raw = JSON.stringify({ strength: "You described listening.", improvement: "Keep it simple.",
      followUp: "What did you say?", betterWording: "I listened to the patient and explained the procedure.",
      whyBetter: "The steps are clear." });
    const result = parseInterviewFeedback(raw, original);
    expect(result.betterWording).toBe("I listened to the patient and explained the procedure.");
    expect(result.whyBetter).toBe("The steps are clear.");
    expect(result.wordingStatus).toBe("grounded");
  });
  it("protects negation and does not turn a refusal into a positive claim", () => {
    const original = "I did not administer medication; I called the supervisor.";
    const raw = JSON.stringify({ strength: "You escalated.", improvement: "Clarify the situation.",
      followUp: "Why?", betterWording: "I administered medication and called the supervisor.",
      whyBetter: "It is more confident." });
    expect(parseInterviewFeedback(raw, original).betterWording).toBe(original);
  });
  it("does not introduce a negation that reverses the candidate's meaning", () => {
    const original = "I administered medication under supervision.";
    const result = parseInterviewFeedback(JSON.stringify({
      strength: "You named supervision.", improvement: "Be clear.",
      followUp: "How was it checked?",
      betterWording: "I did not administer medication under supervision.",
      whyBetter: "It is concise.",
    }), original);
    expect(result.betterWording).toBe(original);
    expect(result.wordingStatus).toBe("copyedit");
  });
  it("refuses fabricated first-person achievements in answer starters", () => {
    const response = parseInterviewQuestion(JSON.stringify({
      question: "How would you respond to a guest complaint at reception?",
      focus: "Customer service",
      answerStarters: ["I resolved 95% of complaints at my last hotel.", "I always led the guest services team."],
    }));
    expect(response.answerStarters).toHaveLength(2);
    expect(response.answerStarters?.join(" ")).not.toContain("95%");
  });
  it("removes unexpected fields and caps untrusted text", () => {
    const data = parseInterviewFeedback(JSON.stringify({
      strength: "A".repeat(500), improvement: "B", example: "", followUp: "C", score: 100,
    }));
    expect(data.strength).toHaveLength(400);
    expect(data).not.toHaveProperty("score");
  });
});
