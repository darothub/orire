import { describe, expect, it } from "vitest";
import { sampleCV } from "@/lib/cv/sample";
import type { CVData } from "@/lib/cv/schema";
import { compareBullets } from "./simulate";

const clone = (): CVData => JSON.parse(JSON.stringify(sampleCV));

describe("compareBullets", () => {
  it("picks your first bullet without a number and flags it", () => {
    const cv = clone();
    cv.experience[0].highlights = ["Cut load time by 38%.", "Improved checkout performance."];
    const ideal = clone();
    ideal.experience[0].highlights = ["Cut checkout load time 38% with bundle splitting."];
    const r = compareBullets(cv, ideal);
    expect(r.yours).toBe("Improved checkout performance.");
    expect(r.yoursLacksNumber).toBe(true);
    expect(r.reference).toBe("Cut checkout load time 38% with bundle splitting.");
  });
  it("falls back to your first bullet and does not flag it when every bullet has a number", () => {
    const cv = clone();
    cv.experience = [{ ...cv.experience[0], highlights: ["Cut load time by 38%."] }];
    const r = compareBullets(cv, clone());
    expect(r.yours).toBe("Cut load time by 38%.");
    expect(r.yoursLacksNumber).toBe(false);
  });
  it("returns nulls when there are no bullets", () => {
    const cv = clone();
    cv.experience = [];
    const ideal = clone();
    ideal.experience = [];
    expect(compareBullets(cv, ideal)).toEqual({ yours: null, reference: null, yoursLacksNumber: false });
  });
});
