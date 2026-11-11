import type { CVData, SectionKey } from "@/lib/cv/schema";
import { MATCH_WEIGHTS, jdKeywords, targetMatch } from "@/lib/ai/simulate";

export interface RankedSkill {
  skill: string;
  /** Estimated match-score points gained by genuinely adding this skill. */
  impact: number;
}

export interface RankedSection {
  key: SectionKey;
  impact: number;
}

/** Missing skills ordered by how much each would raise the match (ties keep target order). */
export function rankMissingSkills(cv: CVData, ideal: CVData, jd: string): RankedSkill[] {
  const base = targetMatch(cv, ideal, jd);
  const groups = cv.skills.length ? cv.skills : [{ id: "impact", category: "Skills", items: [] as string[] }];
  return base.gap.missingSkills
    .map((skill, i) => {
      const next: CVData = {
        ...cv,
        skills: groups.map((g, idx) => (idx === 0 ? { ...g, items: [...g.items, skill] } : g)),
      };
      return { skill, impact: targetMatch(next, ideal, jd).score - base.score, i };
    })
    .sort((a, b) => b.impact - a.impact || a.i - b.i)
    .map(({ skill, impact }) => ({ skill, impact }));
}

/** Estimated gain per missing section; each fills one slot of the sections signal. */
export function rankMissingSections(cv: CVData, ideal: CVData, jd: string): RankedSection[] {
  const { gap } = targetMatch(cv, ideal, jd);
  const hasKw = jdKeywords(jd).length > 0;
  const wSum = Object.entries(MATCH_WEIGHTS).reduce((a, [k, w]) => a + (k === "keywords" && !hasKw ? 0 : w), 0);
  const total = ideal.order.length || 1;
  const impact = Math.round(((100 / total) * MATCH_WEIGHTS.sections) / wSum);
  return gap.missingSections.map((key) => ({ key: key as SectionKey, impact }));
}

export interface ScorePoint {
  t: number;
  score: number;
}

const HISTORY_CAP = 30;

/** Append a score to the run history, skipping repeats and capping its length. */
export function appendHistory(history: ScorePoint[], score: number, t: number): ScorePoint[] {
  const last = history[history.length - 1];
  if (last && last.score === score) return history;
  return [...history, { t, score }].slice(-HISTORY_CAP);
}
