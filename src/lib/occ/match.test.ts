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
  it("bounds output size", () => {
    const result = analyzeEvidence("", Array.from({length: 150}, (_, i) => "technology" + i).join(" "));
    expect(result.checked).toBeLessThanOrEqual(80);
    expect(result.unverifiedTerms.length).toBeLessThanOrEqual(30);
  });
});
