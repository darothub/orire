import { describe, it, expect } from "vitest";
import { employerLogos } from "./logos";

describe("employerLogos", () => {
  const logos = employerLogos();

  it("returns a healthy-sized wall", () => {
    expect(logos.length).toBeGreaterThanOrEqual(6);
  });

  it("has only non-empty, unique wordmarks", () => {
    for (const name of logos) {
      expect(name.trim().length).toBeGreaterThan(0);
    }
    expect(new Set(logos).size).toEqual(logos.length);
  });

  it("returns a fresh array each call (no shared mutation)", () => {
    const a = employerLogos();
    const b = employerLogos();
    expect(a).not.toBe(b);
    a.push("mutated");
    expect(employerLogos()).not.toContain("mutated");
  });
});
