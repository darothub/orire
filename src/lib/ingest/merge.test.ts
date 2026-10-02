import { describe, it, expect } from "vitest";
import { mergeParsedCVs } from "./merge";
import type { ParsedCV } from "./parse";

function cv(partial: Partial<ParsedCV>): ParsedCV {
  return {
    basics: {},
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    notes: [],
    ...partial,
  };
}

describe("mergeParsedCVs", () => {
  it("de-duplicates the same job across files and unions its bullets", () => {
    const a = cv({ experience: [{ id: "a", company: "Acme", role: "Engineer", highlights: ["Built X"] }] });
    const b = cv({ experience: [{ id: "b", company: "ACME", role: "engineer", highlights: ["Built X", "Led Y"] }] });
    const { merged, stats } = mergeParsedCVs([a, b]);
    expect(merged.experience).toHaveLength(1);
    expect(merged.experience[0].highlights).toEqual(["Built X", "Led Y"]);
    expect(stats.duplicatesRemoved).toBe(1);
  });

  it("fills empty fields from a later source without inventing data", () => {
    const a = cv({ experience: [{ id: "a", company: "Acme", role: "Engineer", highlights: [] }] });
    const b = cv({ experience: [{ id: "b", company: "Acme", role: "Engineer", location: "Lagos", startDate: "2020", highlights: [] }] });
    const { merged } = mergeParsedCVs([a, b]);
    expect(merged.experience[0].location).toBe("Lagos");
    expect(merged.experience[0].startDate).toBe("2020");
  });

  it("reports conflicting single-value basics with the first as default", () => {
    const a = cv({ basics: { fullName: "Ada", title: "Engineer" } });
    const b = cv({ basics: { fullName: "Ada", title: "Senior Engineer" } });
    const { merged, conflicts } = mergeParsedCVs([a, b]);
    expect(merged.basics.title).toBe("Engineer");
    const titleConflict = conflicts.find((c) => c.field === "title");
    expect(titleConflict?.values).toEqual(["Engineer", "Senior Engineer"]);
    // Name agrees across files → no conflict.
    expect(conflicts.find((c) => c.field === "fullName")).toBeUndefined();
  });

  it("merges skill groups by category and unions items case-insensitively", () => {
    const a = cv({ skills: [{ id: "a", category: "Languages", items: ["Go", "Rust"] }] });
    const b = cv({ skills: [{ id: "b", category: "languages", items: ["rust", "Python"] }] });
    const { merged } = mergeParsedCVs([a, b]);
    expect(merged.skills).toHaveLength(1);
    expect(merged.skills[0].items).toEqual(["Go", "Rust", "Python"]);
  });
});
