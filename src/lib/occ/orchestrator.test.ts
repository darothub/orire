import { describe, expect, it } from "vitest";
import { planOccTurn } from "./orchestrator";

const empty = { hasCv: false, hasJobDescription: false, hasAdvice: false } as const;

describe("OCC controlled conversation planning", () => {
  it("asks for only the missing inputs", () => {
    const first = planOccTurn("Review my CV for a role", empty);
    expect(first.task).toBe("analysis");
    expect(first.missing).toEqual(["cv", "jobDescription"]);
    expect(planOccTurn("Review my CV for a role", { ...empty, hasCv: true }).missing).toEqual(["jobDescription"]);
    expect(planOccTurn("Review my CV for a role", { ...empty, hasJobDescription: true }).missing).toEqual(["cv"]);
    expect(planOccTurn("Review my CV for a role", { ...empty, hasCv: true, hasJobDescription: true }).missing).toEqual([]);
  });

  it("can capture a follow-up role description when awaiting one", () => {
    const description = "We are looking for an engineer with experience with secure distributed payment services, responsible for API integration, testing and operational reliability.";
    const plan = planOccTurn(description, { ...empty, priorTask: "analysis", hasCv: true });
    expect(plan.captureJobDescription).toBe(true);
    expect(plan.panel).toBe("analysis");
    expect(plan.missing).toEqual([]);
    expect(planOccTurn(description, { ...empty, priorTask: "memory" }).captureJobDescription).toBe(false);
  });

  it("routes profile management without CV or AI calls", () => {
    expect(planOccTurn("Manage my career memory", empty)).toMatchObject({ task: "memory", panel: "memory", missing: [] });
    expect(planOccTurn("Improve my CV", empty)).toMatchObject({ task: "versions", panel: "versions" });
  });

  it("does not pretend unfinished interview coaching is available", () => {
    expect(planOccTurn("Prepare for an interview", empty)).toMatchObject({ task: "interview", panel: "none" });
  });

  it("does not execute arbitrary user instructions or infer sensitive actions", () => {
    const plan = planOccTurn("Send job applications to every company immediately", empty);
    expect(plan.panel).toBe("analysis");
    expect(plan.captureJobDescription).toBe(false);
    expect(plan).not.toHaveProperty("action");
  });
});
