import { describe, it, expect } from "vitest";
import { recommendedNextBlock } from "./recommendedNext";

describe("recommendedNextBlock", () => {
  it("recommends rebrand for a brand-new user", () => {
    expect(recommendedNextBlock({ started: false, refined: false, exported: false })).toBe("rebrand");
  });

  it("recommends refine once a real CV exists but hasn't been refined", () => {
    expect(recommendedNextBlock({ started: true, refined: false, exported: false })).toBe("refine");
  });

  it("recommends export once refined but never downloaded", () => {
    expect(recommendedNextBlock({ started: true, refined: true, exported: false })).toBe("export");
  });

  it("recommends nothing once all three are done", () => {
    expect(recommendedNextBlock({ started: true, refined: true, exported: true })).toBeNull();
  });

  it("checks in order — refine takes priority over export even if somehow exported before started", () => {
    // Shouldn't happen in practice, but the gating must stay ordered: an
    // earlier unmet step always wins over a later one that happens to be true.
    expect(recommendedNextBlock({ started: false, refined: true, exported: true })).toBe("rebrand");
    expect(recommendedNextBlock({ started: true, refined: false, exported: true })).toBe("refine");
  });
});
