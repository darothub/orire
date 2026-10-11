import { describe, it, expect } from "vitest";
import { computePageSlices } from "./pdf";

describe("computePageSlices", () => {
  it("returns a single slice when content fits one page", () => {
    expect(computePageSlices(500, 800, [100, 200, 300])).toEqual([{ start: 0, end: 500 }]);
  });

  it("breaks at the last breakpoint that fits, never cutting a block", () => {
    // page height 100; breakpoints every ~30. First page should end at the
    // last breakpoint <= 100 (i.e. 90), not a hard 100 cut.
    const slices = computePageSlices(250, 100, [30, 60, 90, 120, 150, 180, 210, 240]);
    expect(slices[0]).toEqual({ start: 0, end: 90 });
    // every slice is within the page height and contiguous
    for (let i = 0; i < slices.length; i++) {
      expect(slices[i].end - slices[i].start).toBeLessThanOrEqual(100 + 1e-9);
      if (i > 0) expect(slices[i].start).toBe(slices[i - 1].end);
    }
    expect(slices[slices.length - 1].end).toBe(250);
  });

  it("covers the whole content with no gaps or overlaps", () => {
    const slices = computePageSlices(1000, 300, [250, 280, 560, 590, 850, 870]);
    expect(slices[0].start).toBe(0);
    expect(slices[slices.length - 1].end).toBe(1000);
    for (let i = 1; i < slices.length; i++) expect(slices[i].start).toBe(slices[i - 1].end);
  });

  it("falls back to a hard cut when a block is taller than a page", () => {
    // No breakpoint inside the first page window (all > 300) -> hard cut at 300.
    const slices = computePageSlices(500, 300, [350, 400]);
    expect(slices[0]).toEqual({ start: 0, end: 300 });
  });

  it("ignores breakpoints at or beyond the content edges", () => {
    const slices = computePageSlices(200, 150, [0, 50, 200, 999]);
    expect(slices[0]).toEqual({ start: 0, end: 50 });
    expect(slices[slices.length - 1].end).toBe(200);
  });

  it("is safe on degenerate input", () => {
    expect(computePageSlices(0, 800, [])).toEqual([{ start: 0, end: 0 }]);
    expect(computePageSlices(300, 0, [])).toEqual([{ start: 0, end: 300 }]);
  });
});
