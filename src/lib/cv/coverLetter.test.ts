import { describe, it, expect } from "vitest";
import { coverLetterToText, emptyCoverLetter, type CoverLetter } from "@/lib/cv/coverLetter";

function sampleLetter(): CoverLetter {
  return {
    meta: { role: "Backend Engineer", company: "ScaleCorp", hiringManager: "Dr. Vance" },
    opening: "I am excited to apply.",
    body: ["First point.", "Second point."],
    closing: "I would welcome a conversation.",
    signoff: "Warm regards,",
  };
}

describe("coverLetterToText", () => {
  it("includes sender, recipient, greeting, body and sign-off in order", () => {
    const text = coverLetterToText(sampleLetter(), "Ada Lovelace", "Engineer", "ada@x.com");
    expect(text).toContain("Ada Lovelace");
    expect(text).toContain("Engineer");
    expect(text).toContain("ada@x.com");
    expect(text).toContain("ScaleCorp");
    expect(text).toContain("Re: Backend Engineer");
    expect(text).toContain("Dear Dr. Vance,");
    expect(text).toContain("First point.");
    expect(text).toContain("Second point.");
    expect(text).toContain("Warm regards,");
    // order: opening precedes body precedes closing
    expect(text.indexOf("I am excited")).toBeLessThan(text.indexOf("First point."));
    expect(text.indexOf("Second point.")).toBeLessThan(text.indexOf("I would welcome"));
  });

  it("falls back to a generic greeting when no hiring manager", () => {
    const l = sampleLetter();
    l.meta.hiringManager = undefined;
    expect(coverLetterToText(l, "Ada", "", "")).toContain("Dear Hiring Team,");
  });

  it("is deterministic and collapses blank runs", () => {
    const l = emptyCoverLetter();
    const a = coverLetterToText(l, "Ada", "", "");
    const b = coverLetterToText(l, "Ada", "", "");
    expect(a).toBe(b);
    expect(a).not.toMatch(/\n{3,}/);
  });
});
