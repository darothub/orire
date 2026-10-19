import { describe, it, expect } from "vitest";
import { simulateProgressAt, SIMULATE_STAGES } from "@/lib/ai/simulateProgress";

describe("simulateProgressAt", () => {
  it("starts at 0 on the first stage", () => {
    const p = simulateProgressAt(0);
    expect(p.percent).toBe(0);
    expect(p.label).toBe(SIMULATE_STAGES[0].label);
    expect(p.slow).toBe(false);
  });

  it("never decreases and never reaches 100", () => {
    let prev = -1;
    for (let t = 0; t <= 600_000; t += 1_000) {
      const { percent } = simulateProgressAt(t);
      expect(percent).toBeGreaterThanOrEqual(prev);
      expect(percent).toBeLessThan(100);
      prev = percent;
    }
  });

  it("walks through every stage label in order", () => {
    const seen: string[] = [];
    for (let t = 0; t <= 120_000; t += 500) {
      const { label } = simulateProgressAt(t);
      if (seen[seen.length - 1] !== label) seen.push(label);
    }
    expect(seen).toEqual(SIMULATE_STAGES.map((s) => s.label));
  });

  it("flags slow requests and tolerates negative time", () => {
    expect(simulateProgressAt(31_000).slow).toBe(true);
    expect(simulateProgressAt(-5).percent).toBe(0);
  });
});
