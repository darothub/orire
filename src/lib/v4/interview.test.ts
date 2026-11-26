import { describe, expect, it } from "vitest";
import { answerReady, feedbackRequest, hasRole, questionRequest, stepLabel, TURNS } from "./interview";

describe("v4 interview", () => {
  it("needs a real job description and a real answer, like the API does", () => {
    expect(hasRole("too short")).toBe(false);
    expect(hasRole("Senior frontend engineer building checkout flows for a payments company.")).toBe(true);
    expect(answerReady("short answer")).toBe(false);
    expect(answerReady("I led the checkout rebuild and cut load time.")).toBe(true);
  });

  it("builds the same request bodies the Copilot sends", () => {
    const ctx = { description: "Senior frontend engineer role at a payments company.", cv: "Ada" };
    expect(questionRequest(ctx, 0)).toEqual({ mode: "question", description: ctx.description, cv: "Ada", turnIndex: 0 });
    expect(feedbackRequest({ ...ctx, cv: "" }, 1, "Tell me about a time you led.", "I led the rebuild.")).toEqual({
      mode: "feedback", description: ctx.description, question: "Tell me about a time you led.", answer: "I led the rebuild.", turnIndex: 1,
    });
  });

  it("labels each step with its topic", () => {
    expect(stepLabel(1)).toEqual({ label: `Question 2 of ${TURNS}`, topic: "How you approach your work" });
  });
});
