import { describe, it, expect } from "vitest";
import { cvDataFromParsed } from "./fromParsed";
import { ALL_SECTIONS } from "./schema";
import type { ParsedCV } from "@/lib/ingest/parse";

const base: ParsedCV = {
  basics: { fullName: "Ada Lovelace", title: "Engineer" },
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  notes: [],
};

describe("cvDataFromParsed", () => {
  it("maps basics and defaults empty strings for missing fields", () => {
    const cv = cvDataFromParsed(base);
    expect(cv.basics.fullName).toBe("Ada Lovelace");
    expect(cv.basics.title).toBe("Engineer");
    expect(cv.basics.email).toBe("");
    expect(cv.basics.links).toEqual([]);
  });

  it("gives every CV a full, independent section order", () => {
    const cv = cvDataFromParsed(base);
    expect(cv.order).toEqual(ALL_SECTIONS);
    expect(cv.order).not.toBe(ALL_SECTIONS);
  });

  it("is fact-grounded: carries through only provided list items", () => {
    const parsed: ParsedCV = {
      ...base,
      experience: [{ id: "e1", role: "Dev", company: "Acme", startDate: "", endDate: "", location: "", highlights: ["Shipped X"] }],
      skills: [{ id: "s1", category: "Lang", items: ["Rust"] }],
    };
    const cv = cvDataFromParsed(parsed);
    expect(cv.experience).toHaveLength(1);
    expect(cv.experience[0].highlights).toEqual(["Shipped X"]);
    expect(cv.skills[0].items).toEqual(["Rust"]);
    expect(cv.projects).toEqual([]);
  });
});
