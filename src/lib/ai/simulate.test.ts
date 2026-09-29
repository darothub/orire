import { describe, it, expect } from "vitest";
import { coerceSimulatedCV, gapAnalysis, buildSimulatePrompt } from "@/lib/ai/simulate";
import type { CVData } from "@/lib/cv/schema";

const IDEAL_JSON = JSON.stringify({
  basics: {
    fullName: "Ideal Candidate",
    title: "Senior Backend Engineer",
    email: "candidate@example.com",
    phone: "",
    location: "Remote",
    summary: "Backend engineer with a decade of scale experience.",
    links: [{ label: "GitHub", url: "https://github.com/ideal" }],
  },
  experience: [
    {
      company: "ScaleCorp", role: "Senior Engineer", location: "Remote",
      startDate: "2018", endDate: "Present", current: true,
      highlights: ["Cut latency by 60%"],
    },
  ],
  education: [
    { institution: "State University", degree: "BSc CS", field: "CS", startDate: "2010", endDate: "2014", details: "" },
  ],
  skills: [{ category: "Backend", items: ["Go", "Kubernetes", "PostgreSQL"] }],
  projects: [{ name: "Throughput", role: "Lead", url: "", startDate: "", endDate: "", highlights: ["x"] }],
  certifications: [{ name: "CKA", issuer: "CNCF", date: "2021", url: "" }],
});

function userCV(): CVData {
  return {
    basics: { fullName: "Real Person", title: "Dev", email: "r@x.com", phone: "", location: "Berlin", summary: "Hi.", links: [] },
    experience: [
      { id: "e1", company: "SmallCo", role: "Dev", location: "", startDate: "2020", endDate: "2023", current: false, highlights: ["Shipped features"] },
    ],
    education: [],
    skills: [{ id: "s1", category: "Core", items: ["Go", "Docker"] }],
    projects: [],
    certifications: [],
    order: ["summary", "experience", "skills"],
  };
}

describe("coerceSimulatedCV", () => {
  it("coerces valid model JSON into a CVData with ids and content order", () => {
    const cv = coerceSimulatedCV(IDEAL_JSON);
    expect(cv.basics.fullName).toBe("Ideal Candidate");
    expect(cv.experience[0].id).toMatch(/^exp_/);
    expect(cv.skills[0].items).toContain("Kubernetes");
    expect(cv.order).toEqual([
      "summary", "experience", "education", "skills", "projects", "certifications",
    ]);
  });

  it("applies placeholder identity when the model leaves it blank", () => {
    const cv = coerceSimulatedCV(JSON.stringify({ basics: { summary: "s" } }));
    expect(cv.basics.fullName).toBe("Ideal Candidate");
    expect(cv.basics.email).toBe("candidate@example.com");
  });

  it("drops empty skill groups, projects and certifications from the order", () => {
    const cv = coerceSimulatedCV(JSON.stringify({ basics: { summary: "s" }, skills: [{ category: "x", items: [] }] }));
    expect(cv.order).toEqual(["summary"]);
    expect(cv.skills).toEqual([]);
  });

  it("tolerates fenced JSON output", () => {
    const cv = coerceSimulatedCV("```json\n" + IDEAL_JSON + "\n```");
    expect(cv.basics.title).toBe("Senior Backend Engineer");
  });
});

describe("gapAnalysis", () => {
  it("computes skill coverage as the share of ideal skills the user has", () => {
    const ideal = coerceSimulatedCV(IDEAL_JSON); // Go, Kubernetes, PostgreSQL
    const gap = gapAnalysis(userCV(), ideal); // user has Go, Docker
    expect(gap.coverage).toBe(33); // 1 of 3 matched
    expect(gap.matchedSkills).toContain("Go");
    expect(gap.missingSkills).toEqual(expect.arrayContaining(["Kubernetes", "PostgreSQL"]));
  });

  it("matches skills case-insensitively", () => {
    const ideal = coerceSimulatedCV(JSON.stringify({ skills: [{ category: "c", items: ["GO"] }] }));
    const gap = gapAnalysis(userCV(), ideal);
    expect(gap.coverage).toBe(100);
  });

  it("flags sections the ideal has but the user is missing", () => {
    const ideal = coerceSimulatedCV(IDEAL_JSON);
    const gap = gapAnalysis(userCV(), ideal);
    expect(gap.missingSections).toEqual(
      expect.arrayContaining(["education", "projects", "certifications"])
    );
    expect(gap.missingSections).not.toContain("experience");
  });

  it("returns zero coverage when the ideal lists no skills", () => {
    const ideal = coerceSimulatedCV(JSON.stringify({ basics: { summary: "s" } }));
    expect(gapAnalysis(userCV(), ideal).coverage).toBe(0);
  });
});

describe("buildSimulatePrompt", () => {
  it("embeds the job description and the schema hint", () => {
    const p = buildSimulatePrompt("  Build distributed systems  ");
    expect(p).toContain("Build distributed systems");
    expect(p).toContain("Ideal Candidate");
  });
});
