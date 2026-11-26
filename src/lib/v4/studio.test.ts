import { describe, expect, it } from "vitest";
import { sampleCV } from "@/lib/cv/sample";
import type { CVData } from "@/lib/cv/schema";
import { blockRows, flaggedBullets, nextBlock, roleOptions } from "./studio";

const clone = (): CVData => JSON.parse(JSON.stringify(sampleCV));

describe("blockRows", () => {
  it("lists visible sections in order, then hidden ones", () => {
    const cv = clone();
    cv.order = ["experience", "summary"];
    const rows = blockRows(cv);
    expect(rows.slice(0, 2).map((r) => [r.key, r.visible, r.index])).toEqual([["experience", true, 0], ["summary", true, 1]]);
    expect(rows.slice(2).every((r) => !r.visible && r.index === -1)).toBe(true);
    expect(rows).toHaveLength(6);
  });
});

describe("nextBlock", () => {
  it("points at the first visible empty section", () => {
    const cv = clone();
    cv.order = ["summary", "certifications", "skills"];
    cv.certifications = [];
    expect(nextBlock(cv)).toBe("certifications");
  });
  it("ignores hidden sections and returns null when nothing is empty", () => {
    const cv = clone();
    cv.order = ["summary", "experience"];
    cv.certifications = [];
    expect(nextBlock(cv)).toBeNull();
  });
});

describe("roleOptions", () => {
  it("lists roles then projects with readable labels", () => {
    const cv = clone();
    const opts = roleOptions(cv);
    expect(opts.slice(0, cv.experience.length).every((o) => o.kind === "experience")).toBe(true);
    expect(opts.slice(cv.experience.length).every((o) => o.kind === "project")).toBe(true);
    expect(opts[0].label).toContain(cv.experience[0].company);
  });
});

describe("flaggedBullets", () => {
  it("returns weak bullets with their location and skips empty ones", () => {
    const cv = clone();
    cv.experience[0].highlights = ["Helped with the checkout work", "", "Led a team of 4 and cut load time by 38%."];
    const flagged = flaggedBullets(cv);
    const first = flagged.find((f) => f.id === cv.experience[0].id && f.index === 0);
    expect(first?.flags.map((f) => f.id)).toContain("weak-verb");
    expect(flagged.some((f) => f.id === cv.experience[0].id && f.index === 1)).toBe(false);
  });
});
