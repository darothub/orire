import { describe, it, expect } from "vitest";
import { promises } from "./promises";

describe("promises", () => {
  const items = promises();

  it("returns several promises", () => {
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it("gives every promise a non-empty title and body", () => {
    for (const p of items) {
      expect(p.title.trim().length).toBeGreaterThan(0);
      expect(p.body.trim().length).toBeGreaterThan(0);
    }
  });

  it("carries no attributed-person fields (not fake testimonials)", () => {
    for (const p of items) {
      expect(p).not.toHaveProperty("name");
      expect(p).not.toHaveProperty("role");
      expect(p).not.toHaveProperty("quote");
    }
  });

  it("returns a fresh copy each call (no shared mutation)", () => {
    const a = promises();
    const b = promises();
    expect(a).not.toBe(b);
    a[0].title = "mutated";
    expect(promises()[0].title).not.toEqual("mutated");
  });
});
