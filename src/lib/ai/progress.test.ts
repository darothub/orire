import { describe, expect, it } from "vitest";
import { progressAt } from "./progress";
import { PROGRESS, type ProgressKey } from "@/lib/v4/progressProfiles";

describe("progressAt for every v4 action", () => {
  for (const key of Object.keys(PROGRESS) as ProgressKey[]) {
    const profile = PROGRESS[key];
    it(`${key}: starts at 0, never reaches 100, never goes backwards, walks its stages in order`, () => {
      expect(progressAt(profile, 0)).toMatchObject({ percent: 0, label: profile.stages[0].label, slow: false });
      let prev = -1;
      const seen: string[] = [];
      for (let t = 0; t <= 300_000; t += 500) {
        const p = progressAt(profile, t);
        expect(p.percent).toBeGreaterThanOrEqual(prev);
        expect(p.percent).toBeLessThan(100);
        prev = p.percent;
        if (seen[seen.length - 1] !== p.label) seen.push(p.label);
      }
      expect(seen).toEqual(profile.stages.map((s) => s.label));
      expect(progressAt(profile, profile.slowAfterMs).slow).toBe(true);
    });
  }
});
