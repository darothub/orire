import { describe, it, expect } from "vitest";
import { pickSkillGroupIndex } from "./cvStore";

const g = (category: string) => ({ category });

describe("pickSkillGroupIndex", () => {
  it("targets a general group, never a 'Languages' group (bug: skills landed under Languages)", () => {
    expect(pickSkillGroupIndex([g("Technical"), g("Languages")])).toBe(0);
    expect(pickSkillGroupIndex([g("Languages"), g("Skills")])).toBe(1);
  });

  it("prefers the first general group when several exist", () => {
    expect(pickSkillGroupIndex([g("Core Skills"), g("Tools")])).toBe(0);
  });

  it("treats an empty category as a usable general group", () => {
    expect(pickSkillGroupIndex([g("")])).toBe(0);
  });

  it("falls back to the first non-excluded group when none look general", () => {
    expect(pickSkillGroupIndex([g("Interests"), g("Certifications")])).toBe(1);
  });

  it("falls back to index 0 when every group is excluded", () => {
    expect(pickSkillGroupIndex([g("Languages"), g("Interests")])).toBe(0);
  });
});
