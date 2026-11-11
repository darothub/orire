import { describe, it, expect } from "vitest";
import { sanitizeSequence, RECOMMENDED_FLOW } from "./flowStore";

describe("sanitizeSequence", () => {
  it("folds legacy refine/coach/target blocks into one tailor block at the first position", () => {
    expect(sanitizeSequence(["rebrand", "edit", "refine", "target", "rate", "coach"])).toEqual([
      "rebrand", "edit", "tailor", "rate",
    ]);
  });

  it("drops unknown and duplicate blocks and keeps order", () => {
    expect(sanitizeSequence(["export", "nope", "export", "edit"])).toEqual(["export", "edit"]);
  });

  it("recommended flow has one tailor block and no legacy AI blocks", () => {
    expect(RECOMMENDED_FLOW.filter((v) => v === "tailor")).toHaveLength(1);
    expect(RECOMMENDED_FLOW).not.toContain("refine");
    expect(RECOMMENDED_FLOW).not.toContain("target");
  });
});
