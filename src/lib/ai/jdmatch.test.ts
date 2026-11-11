import { describe, it, expect } from "vitest";
import { extractKeywords, jdMatch, cvText } from "@/lib/ai/jdmatch";
import type { CVData } from "@/lib/cv/schema";

function cv(): CVData {
  return {
    basics: {
      fullName: "Ada Lovelace",
      title: "Backend Engineer",
      email: "ada@example.com",
      phone: "",
      location: "London",
      summary: "Backend engineer building scalable APIs with Python and PostgreSQL.",
      links: [],
    },
    experience: [
      {
        id: "exp_1",
        company: "Acme",
        role: "Engineer",
        location: "London",
        startDate: "2019",
        endDate: "2022",
        current: false,
        highlights: ["Designed Kubernetes deployments and Docker pipelines"],
      },
    ],
    education: [],
    skills: [{ id: "skl_1", category: "Core", items: ["Python", "PostgreSQL", "Kubernetes"] }],
    projects: [],
    certifications: [],
    order: ["summary", "experience", "skills"],
  };
}

describe("extractKeywords", () => {
  it("drops stopwords and generic HR terms", () => {
    const kw = extractKeywords("You will work with the team on strong requirements and skills.");
    expect(kw).not.toContain("the");
    expect(kw).not.toContain("skills");
    expect(kw).not.toContain("requirements");
  });

  it("keeps meaningful technical terms", () => {
    const kw = extractKeywords("We need Python, Kubernetes and PostgreSQL experience.");
    expect(kw).toContain("python");
    expect(kw).toContain("kubernetes");
    expect(kw).toContain("postgresql");
  });
});

describe("extractKeywords noise", () => {
  it("keeps CI/CD whole instead of splitting it into ci and cd", () => {
    const kw = extractKeywords("Own our CI/CD pipelines with Kubernetes.");
    expect(kw).toContain("ci/cd");
    expect(kw).not.toContain("cd");
    expect(kw).not.toContain("ci");
  });

  it("drops generic single words but keeps recurring phrases built from them", () => {
    const kw = extractKeywords(
      "Software engineer to review code and build REST API services. Design a REST API. Review PRs.",
    );
    expect(kw).not.toContain("rest");
    expect(kw).not.toContain("review");
    expect(kw).not.toContain("engineer");
    expect(kw).toContain("rest api");
  });
});

describe("jdMatch CI/CD", () => {
  it("matches CI/CD against a CV that writes it with spaces", () => {
    const c = cv();
    c.skills[0].items.push("CI / CD");
    expect(jdMatch(c, "CI/CD experience").matched).toContain("ci/cd");
  });
});

describe("cvText", () => {
  it("flattens every section into one lowercase haystack", () => {
    const t = cvText(cv());
    expect(t).toContain("python");
    expect(t).toContain("kubernetes");
    expect(t).toContain("docker");
  });
});

describe("jdMatch", () => {
  it("scores high when the CV covers the JD keywords", () => {
    const m = jdMatch(cv(), "Seeking a Python engineer with Kubernetes and PostgreSQL and Docker.");
    expect(m.score).toBeGreaterThanOrEqual(75);
    expect(m.matched).toContain("python");
  });

  it("reports missing keywords the CV lacks", () => {
    const m = jdMatch(cv(), "We need Rust, Terraform and GraphQL skills.");
    expect(m.missing).toContain("rust");
    expect(m.missing).toContain("terraform");
    expect(m.score).toBeLessThan(50);
  });

  it("returns a zero score for an empty JD", () => {
    expect(jdMatch(cv(), "").score).toBe(0);
  });
});
