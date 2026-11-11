import { describe, expect, it } from "vitest";
import { sampleCV } from "@/lib/cv/sample";
import { MAX_SEEDS, sanitizeSeeds, simulateSeeds } from "@/lib/tailor/seeds";
import { buildGapPrompt } from "@/lib/ai/agents";
import type { CVData } from "@/lib/cv/schema";

const ideal: CVData = { ...sampleCV, skills: [{ id: "s", category: "Skills", items: ["Kotlin", "Terraform", "GraphQL"] }] };
const cv: CVData = { ...sampleCV, skills: [{ id: "s", category: "Skills", items: ["GraphQL"] }] };

describe("simulateSeeds", () => {
  it("returns the skills Simulate found missing", () => {
    const seeds = simulateSeeds(cv, { ideal, idealJd: "JD" }, "JD");
    expect(seeds).toEqual(expect.arrayContaining(["Kotlin", "Terraform"]));
    expect(seeds).not.toContain("GraphQL");
  });
  it("is empty with no target, or when the target is for another job", () => {
    expect(simulateSeeds(cv, { ideal: null, idealJd: "" }, "JD")).toEqual([]);
    expect(simulateSeeds(cv, { ideal, idealJd: "Old JD" }, "JD")).toEqual([]);
  });
});

describe("sanitizeSeeds", () => {
  it("keeps distinct trimmed strings, bounded", () => {
    const many = Array.from({ length: 20 }, (_, i) => `skill ${i}`);
    expect(sanitizeSeeds(many)).toHaveLength(MAX_SEEDS);
    expect(sanitizeSeeds([" Go ", "go", 5, "", "Rust"])).toEqual(["Go", "Rust"]);
    expect(sanitizeSeeds("nope")).toEqual([]);
    expect(sanitizeSeeds(["x".repeat(200)])[0]).toHaveLength(60);
  });
});

describe("gap prompt seeds", () => {
  const profile = { roleTitle: "Dev", seniority: "", mustHaves: [], niceToHaves: [], keywords: [], responsibilities: [] } as never;
  it("lists seeds as hints, and omits the block without them", () => {
    expect(buildGapPrompt(cv, profile, ["Kotlin"])).toContain("flagged these skills as possibly missing: Kotlin");
    expect(buildGapPrompt(cv, profile)).not.toContain("SIMULATION");
  });
});
