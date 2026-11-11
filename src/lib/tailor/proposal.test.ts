import { describe, it, expect } from "vitest";
import { sampleCV } from "@/lib/cv/sample";
import type { CVData } from "@/lib/cv/schema";
import { applyOffered, cvHash, rebaseProposal } from "./proposal";

const clone = (c: CVData): CVData => JSON.parse(JSON.stringify(c));

function rewritten(base: CVData): CVData {
  const after = clone(base);
  after.basics.summary = "Rewritten summary for the role.";
  after.experience[0].highlights = ["Cut deploy time 40% by automating releases"];
  return after;
}

describe("cvHash", () => {
  it("changes when the CV changes and is stable otherwise", () => {
    const a = clone(sampleCV);
    expect(cvHash(a)).toBe(cvHash(clone(sampleCV)));
    a.basics.title = "Something else";
    expect(cvHash(a)).not.toBe(cvHash(sampleCV));
  });
});

describe("rebaseProposal", () => {
  it("is not stale and offers every change when the CV is unchanged", () => {
    const after = rewritten(sampleCV);
    const r = rebaseProposal(sampleCV, after, clone(sampleCV));
    expect(r.stale).toBe(false);
    expect(r.changes.map((c) => c.id).sort()).toEqual(["exp:0", "summary"]);
    expect(r.skipped).toEqual([]);
  });

  it("keeps changes the user did not touch and skips the ones they edited", () => {
    const after = rewritten(sampleCV);
    const live = clone(sampleCV);
    live.basics.summary = "My own summary, edited after the run.";
    const r = rebaseProposal(sampleCV, after, live);
    expect(r.stale).toBe(true);
    expect(r.changes.map((c) => c.id)).toEqual(["exp:0"]);
    expect(r.skipped.map((c) => c.id)).toEqual(["summary"]);
  });

  it("never offers a change the proposal did not make, so user edits are not reverted", () => {
    const after = rewritten(sampleCV);
    const live = clone(sampleCV);
    live.basics.title = "Principal Engineer";
    const r = rebaseProposal(sampleCV, after, live);
    expect(r.changes.map((c) => c.id)).not.toContain("title");
    expect(r.skipped.map((c) => c.id)).not.toContain("title");
  });

  it("applies cleanly onto the live CV and preserves the user's edit", () => {
    const after = rewritten(sampleCV);
    const live = clone(sampleCV);
    live.basics.title = "Principal Engineer";
    const { changes } = rebaseProposal(sampleCV, after, live);
    const out = applyOffered(live, after, changes, []);
    expect(out.basics.title).toBe("Principal Engineer");
    expect(out.basics.summary).toBe("Rewritten summary for the role.");
    expect(out.experience[0].highlights[0]).toContain("Cut deploy time");
  });

  it("does not apply changes the user rejected", () => {
    const after = rewritten(sampleCV);
    const { changes } = rebaseProposal(sampleCV, after, clone(sampleCV));
    const out = applyOffered(clone(sampleCV), after, changes, ["summary"]);
    expect(out.basics.summary).toBe(sampleCV.basics.summary);
    expect(out.experience[0].highlights[0]).toContain("Cut deploy time");
  });
});
