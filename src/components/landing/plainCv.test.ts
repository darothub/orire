import { describe, it, expect } from "vitest";
import { plainCvLines } from "@/components/landing/plainCv";
import { sampleCV } from "@/lib/cv/sample";

describe("plainCvLines", () => {
  const lines = plainCvLines(sampleCV);
  const text = lines.join("\n");

  it("leads with the person's name and title", () => {
    expect(lines[0]).toBe(sampleCV.basics.fullName);
    expect(lines[1]).toBe(sampleCV.basics.title);
  });

  it("includes the uppercase plain section headers", () => {
    expect(text).toContain("EXPERIENCE");
    expect(text).toContain("EDUCATION");
    expect(text).toContain("SKILLS");
  });

  it("flattens experience highlights as dashed bullets", () => {
    const first = sampleCV.experience[0].highlights[0];
    expect(text).toContain(`- ${first}`);
  });

  it("marks a current role as present", () => {
    expect(text).toContain("present");
  });

  it("produces only plain string lines (no markup)", () => {
    for (const l of lines) {
      expect(typeof l).toBe("string");
      expect(l).not.toMatch(/<[a-z]/i);
    }
  });
});
