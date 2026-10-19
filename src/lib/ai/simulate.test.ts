import { describe, it, expect } from "vitest";
import { coerceSimulatedCV, gapAnalysis, buildSimulatePrompt, targetMatch, jdKeywords } from "@/lib/ai/simulate";
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

  it("credits plain user skills against the ideal's richly-described skills", () => {
    const ideal = coerceSimulatedCV(JSON.stringify({
      skills: [{ category: "Design", items: [
        "Figma (expert: components, variables, auto-layout, prototyping, design tokens)",
        "WCAG 2.2 AA compliance (ARIA attributes, semantic HTML, keyboard navigation)",
        "Design tokens (Figma Variables, Tokens Studio, token pipelines)",
      ] }],
    }));
    const cv: CVData = {
      ...userCV(),
      skills: [{ id: "s1", category: "Core", items: ["Figma", "WCAG 2.2 AA accessibility", "Design tokens"] }],
    };
    const gap = gapAnalysis(cv, ideal);
    expect(gap.coverage).toBe(100);
    expect(gap.missingSkills).toEqual([]);
  });

  it("does not credit a match on a shared generic token alone", () => {
    const ideal = coerceSimulatedCV(JSON.stringify({
      skills: [{ category: "c", items: ["Design system governance and versioning"] }],
    }));
    const cv: CVData = {
      ...userCV(),
      skills: [{ id: "s1", category: "Core", items: ["Interaction design"] }],
    };
    expect(gapAnalysis(cv, ideal).coverage).toBe(0);
  });
});

describe("jdKeywords", () => {
  it("ranks salient terms by frequency and drops stopwords", () => {
    const kws = jdKeywords("Kubernetes Kubernetes platform with the team and the team");
    expect(kws).toContain("kubernetes");
    expect(kws).toContain("platform");
    expect(kws).not.toContain("the");
    expect(kws).not.toContain("and");
    expect(kws).not.toContain("with");
    expect(kws[0]).toBe("kubernetes");
  });

  it("is deterministic for the same input", () => {
    const jd = "Go PostgreSQL latency scaling observability";
    expect(jdKeywords(jd)).toEqual(jdKeywords(jd));
  });
});

describe("targetMatch", () => {
  it("is deterministic and returns an overall 0–100 score", () => {
    const ideal = coerceSimulatedCV(IDEAL_JSON);
    const a = targetMatch(userCV(), ideal, "Go Kubernetes PostgreSQL");
    const b = targetMatch(userCV(), ideal, "Go Kubernetes PostgreSQL");
    expect(a.score).toBe(b.score);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
  });

  it("includes the JD-keyword metric only when a JD is supplied", () => {
    const ideal = coerceSimulatedCV(IDEAL_JSON);
    const withJd = targetMatch(userCV(), ideal, "Go Kubernetes");
    const noJd = targetMatch(userCV(), ideal, "");
    expect(withJd.metrics.some((m) => m.key === "keywords")).toBe(true);
    expect(noJd.metrics.some((m) => m.key === "keywords")).toBe(false);
  });

  it("rises when the user adds a quantified bullet (edit-sensitive)", () => {
    const ideal = coerceSimulatedCV(IDEAL_JSON);
    const before = targetMatch(userCV(), ideal, "backend");
    const improved = userCV();
    improved.experience[0].highlights = ["Cut latency by 40% across services"];
    const after = targetMatch(improved, ideal, "backend");
    const dBefore = before.metrics.find((m) => m.key === "metrics")!.score;
    const dAfter = after.metrics.find((m) => m.key === "metrics")!.score;
    expect(dAfter).toBeGreaterThan(dBefore);
  });

  it("surfaces the underlying skill gap", () => {
    const ideal = coerceSimulatedCV(IDEAL_JSON);
    const m = targetMatch(userCV(), ideal, "");
    expect(m.gap.matchedSkills).toContain("Go");
    expect(m.gap.missingSkills).toEqual(expect.arrayContaining(["Kubernetes", "PostgreSQL"]));
  });

  it("rises when skills from an applied refine land on the working CV", () => {
    const ideal = coerceSimulatedCV(IDEAL_JSON);
    const before = targetMatch(userCV(), ideal, "Go Kubernetes PostgreSQL");
    // Simulate applyRefinedCV: replace working skills with refine output.
    const afterRefine = userCV();
    afterRefine.skills = [
      { id: "s1", category: "Backend", items: ["Go", "Docker", "Kubernetes", "PostgreSQL"] },
    ];
    const after = targetMatch(afterRefine, ideal, "Go Kubernetes PostgreSQL");
    expect(after.score).toBeGreaterThan(before.score);
    expect(after.gap.coverage).toBe(100);
    expect(after.gap.missingSkills).toEqual([]);
  });
});

describe("buildSimulatePrompt", () => {
  it("embeds the job description and the schema hint", () => {
    const p = buildSimulatePrompt("  Build distributed systems  ");
    expect(p).toContain("Build distributed systems");
    expect(p).toContain("Ideal Candidate");
  });
});
