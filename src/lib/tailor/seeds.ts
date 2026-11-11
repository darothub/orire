import type { CVData } from "@/lib/cv/schema";
import { rankMissingSkills } from "@/lib/ai/simulateImpact";

export const MAX_SEEDS = 8;
const SEED_MAX = 60;

/**
 * Skills Simulate found missing from the CV, highest match impact first. These
 * are hints for Coach to ask about, never facts. Empty unless the saved target
 * was simulated from the job description currently in use.
 */
export function simulateSeeds(cv: CVData, target: { ideal: CVData | null; idealJd: string }, jd: string): string[] {
  if (!target.ideal || target.idealJd.trim() !== jd.trim()) return [];
  return sanitizeSeeds(rankMissingSkills(cv, target.ideal, jd).map((s) => s.skill));
}

/** Untrusted input: keep distinct short strings, bounded in count. */
export function sanitizeSeeds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") continue;
    const s = x.replace(/\s+/g, " ").trim().slice(0, SEED_MAX);
    const k = s.toLowerCase();
    if (!s || seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length === MAX_SEEDS) break;
  }
  return out;
}
