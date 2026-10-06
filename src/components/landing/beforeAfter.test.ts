import { describe, it, expect } from "vitest";
import { beforeAfterLines } from "./beforeAfter";

describe("beforeAfterLines", () => {
  const lines = beforeAfterLines();

  it("returns several transformation pairs", () => {
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });

  it("gives every pair non-empty, distinct before/after copy", () => {
    for (const line of lines) {
      expect(line.before.trim().length).toBeGreaterThan(0);
      expect(line.after.trim().length).toBeGreaterThan(0);
      expect(line.before).not.toEqual(line.after);
    }
  });

  it("makes the after copy quantified (contains a digit)", () => {
    for (const line of lines) {
      expect(line.after).toMatch(/\d/);
    }
  });

  it("returns a fresh copy each call (no shared mutation)", () => {
    const a = beforeAfterLines();
    const b = beforeAfterLines();
    expect(a).not.toBe(b);
    a[0].after = "mutated";
    expect(beforeAfterLines()[0].after).not.toEqual("mutated");
  });
});
