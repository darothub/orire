import { describe, it, expect } from "vitest";
import { testimonials } from "./testimonials";

describe("testimonials", () => {
  const items = testimonials();

  it("returns several testimonials", () => {
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it("gives every testimonial non-empty quote, name and role", () => {
    for (const t of items) {
      expect(t.quote.trim().length).toBeGreaterThan(0);
      expect(t.name.trim().length).toBeGreaterThan(0);
      expect(t.role.trim().length).toBeGreaterThan(0);
    }
  });

  it("derives an uppercase initial matching the name", () => {
    for (const t of items) {
      expect(t.initial).toEqual(t.name.trim().charAt(0).toUpperCase());
      expect(t.initial).toMatch(/^[A-Z]$/);
    }
  });

  it("returns a fresh copy each call (no shared mutation)", () => {
    const a = testimonials();
    const b = testimonials();
    expect(a).not.toBe(b);
    a[0].quote = "mutated";
    expect(testimonials()[0].quote).not.toEqual("mutated");
  });
});
