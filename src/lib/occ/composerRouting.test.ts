import { describe, expect, it } from "vitest";
import { planOccAgentSend } from "./composerRouting";

const role = "We are hiring an experienced engineer. You will design secure production services and deliver reliable integrations with testing responsibilities.";
const context = { message: "Please help me", hasCv: true, hasJobDescription: true, interviewPhase: "idle" as const };

describe("OCC Composer V2 explicit agent routing", () => {
  it("does not change selected Review agent when message mentions interviews", () => {
    expect(planOccAgentSend({ ...context, agent: "review", message: "Can my CV support an interview for this role?" }).action).toBe("review");
  });
  it("routes Interview Send to a question and then to feedback", () => {
    expect(planOccAgentSend({ ...context, agent: "interview" }).action).toBe("interview-question");
    expect(planOccAgentSend({ ...context, agent: "interview", interviewPhase: "question" }).action).toBe("interview-answer");
  });
  it("asks for role context when missing instead of invoking interview AI", () => {
    expect(planOccAgentSend({ ...context, agent: "interview", hasJobDescription: false }).action).toBe("missing");
  });
  it("accepts a pasted JD on Send, without misrouting the selected agent", () => {
    expect(planOccAgentSend({ ...context, agent: "review", message: role, hasJobDescription: false })).toMatchObject({
      action: "review", jobDescription: role,
    });
  });
  it("keeps CV review gated on document readiness", () => {
    expect(planOccAgentSend({ ...context, agent: "review", hasCv: false }).action).toBe("missing");
  });
  it("exposes improvement and memory inside the timeline", () => {
    expect(planOccAgentSend({ ...context, agent: "improve" }).action).toBe("improve");
    expect(planOccAgentSend({ ...context, agent: "memory" }).action).toBe("memory");
  });
});
