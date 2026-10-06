import { describe, it, expect } from "vitest";
import { ratingStats } from "./activity";

describe("ratingStats", () => {
  it("returns nulls for no runs", () => {
    expect(ratingStats([])).toEqual({ bestRating: null, bestImprovement: null, ratedRuns: 0 });
  });

  it("ignores runs without a final rating", () => {
    const s = ratingStats([
      { ratingBefore: 40, ratingAfter: null },
      { ratingBefore: null, ratingAfter: null },
    ]);
    expect(s).toEqual({ bestRating: null, bestImprovement: null, ratedRuns: 0 });
  });

  it("picks the highest final rating", () => {
    const s = ratingStats([
      { ratingBefore: 50, ratingAfter: 72 },
      { ratingBefore: 60, ratingAfter: 88 },
      { ratingBefore: 70, ratingAfter: 81 },
    ]);
    expect(s.bestRating).toBe(88);
    expect(s.ratedRuns).toBe(3);
  });

  it("picks the largest improvement, not tied to the best rating", () => {
    const s = ratingStats([
      { ratingBefore: 50, ratingAfter: 72 }, // +22
      { ratingBefore: 85, ratingAfter: 88 }, // +3 (best rating)
    ]);
    expect(s.bestImprovement).toBe(22);
  });

  it("counts an improvement even when the before rating is missing only for others", () => {
    const s = ratingStats([
      { ratingBefore: null, ratingAfter: 90 }, // rated, no improvement measurable
      { ratingBefore: 40, ratingAfter: 55 }, // +15
    ]);
    expect(s.bestRating).toBe(90);
    expect(s.bestImprovement).toBe(15);
    expect(s.ratedRuns).toBe(2);
  });

  it("allows negative improvement when every run regressed", () => {
    const s = ratingStats([{ ratingBefore: 80, ratingAfter: 60 }]);
    expect(s.bestImprovement).toBe(-20);
  });
});
