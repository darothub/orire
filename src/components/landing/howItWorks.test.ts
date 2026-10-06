import { describe, expect, it } from "vitest";
import { howItWorksSteps } from "@/components/landing/howItWorks";

describe("howItWorksSteps", () => {
  it("returns exactly three steps", () => {
    expect(howItWorksSteps()).toHaveLength(3);
  });

  it("numbers steps 1..3 in order", () => {
    expect(howItWorksSteps().map((s) => s.n)).toEqual([1, 2, 3]);
  });

  it("gives every step a title, body and icon", () => {
    for (const step of howItWorksSteps()) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
      expect(step.icon.length).toBeGreaterThan(0);
    }
  });

  it("follows the upload → tailor → export arc", () => {
    const [first, , last] = howItWorksSteps();
    expect(first.title.toLowerCase()).toContain("upload");
    expect(last.title.toLowerCase()).toContain("export");
  });
});
