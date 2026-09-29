import { describe, it, expect } from "vitest";
import { scoreCV, diffScores, grade } from "@/lib/cv/rating";
import { sampleCV } from "@/lib/cv/sample";
import type { CVData } from "@/lib/cv/schema";

function emptyCV(): CVData {
  return {
    basics: { fullName: "", title: "", email: "", phone: "", location: "", summary: "", links: [] },
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    order: ["summary", "experience", "education", "skills", "projects", "certifications"],
  };
}

describe("scoreCV — determinism", () => {
  it("returns the same score for the same CV every time", () => {
    const a = scoreCV(sampleCV);
    const b = scoreCV(sampleCV);
    expect(a.overall).toBe(b.overall);
    expect(a.metrics).toEqual(b.metrics);
  });

  it("keeps overall within 0–100", () => {
    const s = scoreCV(sampleCV);
    expect(s.overall).toBeGreaterThanOrEqual(0);
    expect(s.overall).toBeLessThanOrEqual(100);
  });

  it("scores an empty CV low (small structural baseline, well under a filled CV)", () => {
    const empty = scoreCV(emptyCV()).overall;
    expect(empty).toBeLessThan(25);
    expect(empty).toBeLessThan(scoreCV(sampleCV).overall);
  });

  it("exposes all six rubric metrics", () => {
    const keys = scoreCV(sampleCV).metrics.map((m) => m.key).sort();
    expect(keys).toEqual(
      ["actionVerbs", "clarity", "completeness", "conciseness", "impact", "skills"].sort()
    );
  });
});

describe("scoreCV — metric behaviour", () => {
  it("rewards quantified, action-led bullets on impact + action verbs", () => {
    const cv = emptyCV();
    cv.experience = [
      {
        id: "e1", company: "Acme", role: "Eng", location: "", startDate: "", endDate: "",
        current: false,
        highlights: ["Increased revenue by 40% across three regions"],
      },
    ];
    const m = Object.fromEntries(scoreCV(cv).metrics.map((x) => [x.key, x.value]));
    expect(m.impact).toBeGreaterThan(0);
    expect(m.actionVerbs).toBeGreaterThan(0);
  });

  it("gives zero impact when no bullet carries a metric", () => {
    const cv = emptyCV();
    cv.experience = [
      {
        id: "e1", company: "Acme", role: "Eng", location: "", startDate: "", endDate: "",
        current: false,
        highlights: ["Worked on various tasks and helped the team"],
      },
    ];
    const impact = scoreCV(cv).metrics.find((x) => x.key === "impact")!.value;
    expect(impact).toBe(0);
  });
});

describe("diffScores", () => {
  it("reports a positive delta when the CV improves", () => {
    const d = diffScores(emptyCV(), sampleCV);
    expect(d.after).toBeGreaterThan(d.before);
    expect(d.diff).toBe(d.after - d.before);
    expect(d.diff).toBeGreaterThan(0);
    expect(d.metrics).toHaveLength(6);
    for (const m of d.metrics) expect(m.diff).toBe(m.after - m.before);
  });

  it("reports a zero delta for identical CVs", () => {
    const d = diffScores(sampleCV, sampleCV);
    expect(d.diff).toBe(0);
  });
});

describe("grade", () => {
  it("maps score bands to labels", () => {
    expect(grade(95)).toBe("Outstanding");
    expect(grade(80)).toBe("Strong");
    expect(grade(65)).toBe("Solid");
    expect(grade(50)).toBe("Developing");
    expect(grade(10)).toBe("Needs work");
  });
});
