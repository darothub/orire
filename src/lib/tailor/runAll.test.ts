import { describe, it, expect } from "vitest";
import { allowRunAll, currentStep, finishRun, isFinished, markStep, startRun, stopAtCap } from "./runAll";

describe("run all", () => {
  it("is Pro/Career only", () => {
    expect(allowRunAll("free")).toBe(false);
    expect(allowRunAll("pro")).toBe(true);
    expect(allowRunAll("career")).toBe(true);
  });

  it("walks the steps in order and skips cost nothing", () => {
    let s = startRun(40);
    expect(currentStep(s)).toBe("simulate");
    s = markStep(s, "simulate", "done");
    s = markStep(s, "coach", "skipped");
    expect(currentStep(s)).toBe("refine");
    s = markStep(s, "refine", "done");
    expect(isFinished(s)).toBe(true);
    expect(finishRun(s, 62)).toMatchObject({ before: 40, after: 62 });
  });

  it("a capped step stops the run and keeps earlier results", () => {
    let s = markStep(startRun(10), "simulate", "done");
    s = stopAtCap(s, "coach");
    expect(s.statuses).toEqual({ simulate: "done", coach: "capped", refine: "skipped" });
    expect(isFinished(s)).toBe(true);
  });
});
