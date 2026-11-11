import { describe, it, expect } from "vitest";
import { appendHistory, rankMissingSkills, rankMissingSections } from "@/lib/ai/simulateImpact";
import type { CVData } from "@/lib/cv/schema";

function cv(skills: string[], order: CVData["order"] = ["skills"]): CVData {
  return {
    basics: { fullName: "", title: "", email: "", phone: "", location: "", summary: "", links: [] },
    experience: [],
    education: [],
    skills: [{ id: "g", category: "Skills", items: skills }],
    projects: [],
    certifications: [],
    order,
  } as CVData;
}

describe("simulateImpact", () => {
  it("ranks missing skills with non-negative impact", () => {
    const ranked = rankMissingSkills(cv(["Go"]), cv(["Go", "Rust", "Kafka"]), "Rust Kafka");
    expect(ranked.map((r) => r.skill).sort()).toEqual(["Kafka", "Rust"]);
    expect(ranked.every((r) => r.impact >= 0)).toBe(true);
    expect(ranked[0].impact).toBeGreaterThanOrEqual(ranked[1].impact);
  });

  it("estimates section impact for each missing section", () => {
    const ideal = cv(["Go"], ["summary", "skills"]);
    const ranked = rankMissingSections(cv(["Go"], ["skills"]), ideal, "");
    expect(ranked.map((r) => r.key)).toEqual(["summary"]);
    expect(ranked[0].impact).toBeGreaterThan(0);
  });

  it("appendHistory dedupes repeats and caps length", () => {
    let h = appendHistory([], 40, 1);
    h = appendHistory(h, 40, 2);
    expect(h).toHaveLength(1);
    for (let i = 0; i < 50; i++) h = appendHistory(h, i + 50, i);
    expect(h).toHaveLength(30);
  });
});
