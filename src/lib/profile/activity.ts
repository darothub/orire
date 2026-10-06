/**
 * Pure activity aggregation for the profile page. Kept framework-free so the
 * rating/improvement math is unit-testable without a database.
 */

export interface RunLike {
  ratingBefore: number | null;
  ratingAfter: number | null;
}

export interface RatingStats {
  /** Highest final rating achieved across all refine runs, or null if none. */
  bestRating: number | null;
  /** Largest initial → final gain across runs, or null if none measurable. */
  bestImprovement: number | null;
  /** Number of runs that carry a usable final rating. */
  ratedRuns: number;
}

/** Collapse refine runs into the headline rating stats shown on the profile. */
export function ratingStats(runs: RunLike[]): RatingStats {
  let bestRating: number | null = null;
  let bestImprovement: number | null = null;
  let ratedRuns = 0;

  for (const r of runs) {
    if (typeof r.ratingAfter === "number") {
      ratedRuns += 1;
      if (bestRating === null || r.ratingAfter > bestRating) bestRating = r.ratingAfter;
      if (typeof r.ratingBefore === "number") {
        const gain = r.ratingAfter - r.ratingBefore;
        if (bestImprovement === null || gain > bestImprovement) bestImprovement = gain;
      }
    }
  }

  return { bestRating, bestImprovement, ratedRuns };
}
