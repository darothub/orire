import { describe, expect, it } from "vitest";
import { blankCV, pruneBlankEntries, emptyProject } from "./schema";

describe("blankCV / pruneBlankEntries", () => {
  it("starts empty with one blank role and school", () => {
    const cv = blankCV();
    expect(cv.basics.fullName).toBe("");
    expect(cv.experience).toHaveLength(1);
    expect(cv.education).toHaveLength(1);
    expect(cv.projects).toEqual([]);
  });

  it("drops blank entries and bullets but keeps filled ones", () => {
    const cv = blankCV();
    cv.experience[0].role = "Designer";
    cv.experience[0].highlights = ["Did a thing", "  "];
    cv.projects = [emptyProject(), { ...emptyProject(), name: "Map", highlights: ["", "Built it"] }];
    const out = pruneBlankEntries(cv);
    expect(out.experience[0].highlights).toEqual(["Did a thing"]);
    expect(out.education).toHaveLength(0);
    expect(out.projects).toHaveLength(1);
    expect(out.projects[0].highlights).toEqual(["Built it"]);
  });
});
