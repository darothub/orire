import { describe, it, expect } from "vitest";
import { analyzeTone, toneBullets, buildRetonePrompt } from "@/lib/ai/retone";
import type { CVData } from "@/lib/cv/schema";

function makeCV(highlights: string[], summary = ""): CVData {
  return {
    basics: { fullName: "Target", title: "Lead", email: "t@x.com", phone: "", location: "", summary, links: [] },
    experience: [
      {
        id: "e1", company: "Co", role: "Engineer", location: "", startDate: "2019", endDate: "2024",
        current: false, highlights,
      },
    ],
    education: [],
    skills: [{ id: "s1", category: "Core", items: ["Java"] }],
    projects: [],
    certifications: [],
    order: ["summary", "experience", "skills"],
  };
}

describe("analyzeTone", () => {
  it("detects an executive voice from leadership verbs + metrics", () => {
    const cv = makeCV([
      "Led a team of 12 engineers, growing revenue by 30%",
      "Owned the platform roadmap and drove 2x adoption",
      "Established the architecture guild across 4 squads",
      "Scaled the org from 5 to 40 while delivering 99.9% uptime",
    ]);
    expect(analyzeTone(cv).label).toBe("Executive");
  });

  it("detects a technical voice from implementation + systems language", () => {
    const cv = makeCV([
      "Designed a Kafka pipeline and optimised consumer throughput",
      "Built REST APIs backed by a PostgreSQL schema",
      "Refactored the service to cut latency in the JVM runtime",
      "Engineered a Kubernetes deployment with gRPC endpoints",
    ]);
    expect(analyzeTone(cv).label).toBe("Technical");
  });

  it("is deterministic for the same input", () => {
    const cv = makeCV(["Led the migration", "Built the service"]);
    expect(analyzeTone(cv)).toEqual(analyzeTone(cv));
  });

  it("picks exemplars that embody the detected voice", () => {
    const cv = makeCV([
      "Led a team of 12 engineers, growing revenue by 30%",
      "Owned the platform roadmap and drove 2x adoption",
      "Did some small task",
    ]);
    const tone = analyzeTone(cv);
    expect(tone.label).toBe("Executive");
    expect(tone.exemplars.length).toBeGreaterThan(0);
    expect(tone.exemplars.length).toBeLessThanOrEqual(3);
  });

  it("includes the summary as a bullet source", () => {
    const cv = makeCV(["Built APIs"], "A seasoned engineer.");
    expect(toneBullets(cv)).toContain("A seasoned engineer.");
  });

  it("never emits the target's facts as instructions — exemplars are flagged style-only", () => {
    const cv = makeCV(["Led a 30% revenue lift across 4 squads"]);
    const prompt = buildRetonePrompt(cv, analyzeTone(cv));
    expect(prompt).toContain("voice only");
    expect(prompt).toContain("never copy their facts");
  });

  it("instructs the model to preserve titles and omit title/role fields", () => {
    const cv = makeCV(["Led a 30% revenue lift across 4 squads"]);
    const prompt = buildRetonePrompt(cv, analyzeTone(cv));
    expect(prompt).toContain("Keep every job title and the headline exactly");
    expect(prompt).toContain('Do NOT emit a "title" field');
  });
});
