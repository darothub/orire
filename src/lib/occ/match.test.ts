import { describe, expect, it } from "vitest";
import { analyzeEvidence } from "./match";

describe("OCC evidence matcher", () => {
  it("identifies stated overlap and unverified terms without inventing experience", () => {
    const result = analyzeEvidence("Built Kotlin services with Kafka", "Need Kotlin, Kafka and Kubernetes");
    expect(result.matchedTerms).toEqual(expect.arrayContaining(["kotlin", "kafka"]));
    expect(result.unverifiedTerms).toContain("kubernetes");
  });
  it("does not equate absence with lack of skill", () => {
    expect(analyzeEvidence("", "Kubernetes").disclaimer).toContain("do not prove");
  });
  it("reports a deterministic keyword-coverage score", () => {
    const result = analyzeEvidence("Built Kotlin services with Kafka", "Need Kotlin, Kafka and Kubernetes");
    expect(result.coverage).toBe(67); // 2 of 3 role terms present
    expect(result.matched).toBe(2);
    expect(result.checked).toBe(3);
  });
  it("coverage is 0 when nothing matches and 100 when all match", () => {
    expect(analyzeEvidence("", "Kubernetes").coverage).toBe(0);
    expect(analyzeEvidence("react typescript", "react typescript").coverage).toBe(100);
  });
  it("ignores marketing boilerplate and surfaces real requirements", () => {
    const jd =
      "Why join us? We are shaping the future of mobility, helping companies worldwide " +
      "manage their fleet every day. You will build Spring Boot services on PostgreSQL, " +
      "run Kubernetes and own CI/CD pipelines.";
    const result = analyzeEvidence("", jd);
    const junk = ["why", "together", "day", "every", "worldwide", "companies", "shaping", "future", "manage"];
    for (const w of junk) expect(result.unverifiedTerms).not.toContain(w);
    expect(result.unverifiedTerms).toEqual(
      expect.arrayContaining(["postgresql", "kubernetes"]),
    );
  });
  it("bounds output size", () => {
    const result = analyzeEvidence("", Array.from({length: 150}, (_, i) => "technology" + i).join(" "));
    expect(result.checked).toBeLessThanOrEqual(80);
    expect(result.unverifiedTerms.length).toBeLessThanOrEqual(30);
  });
});
