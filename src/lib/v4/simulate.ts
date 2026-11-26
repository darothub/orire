import type { CVData } from "@/lib/cv/schema";
import { hasMeasurable } from "@/lib/ai/evidence";

export interface BulletPair {
  yours: string | null;
  reference: string | null;
  /** True when your bullet has no number, so the gap is worth pointing at. */
  yoursLacksNumber: boolean;
}

function firstBullet(cv: CVData): string | null {
  for (const e of cv.experience) {
    const b = e.highlights.find((h) => h.trim());
    if (b) return b.trim();
  }
  return null;
}

/**
 * One bullet from each side for the compare card. Prefers the first of your
 * bullets that carries no number (the clearest gap to the reference); the
 * reference bullet is its first bullet. The reference is an example of the
 * level to aim for, never text to copy into the CV.
 */
export function compareBullets(cv: CVData, ideal: CVData): BulletPair {
  const all = cv.experience.flatMap((e) => e.highlights).map((h) => h.trim()).filter(Boolean);
  const weak = all.find((h) => !hasMeasurable(h));
  const yours = weak ?? firstBullet(cv);
  return { yours, reference: firstBullet(ideal), yoursLacksNumber: yours !== null && !hasMeasurable(yours) };
}
