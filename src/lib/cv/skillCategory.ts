import type { SkillGroup } from "@/lib/cv/schema";

/** Skill groups of the simulated ideal CV; used only to learn which skills belong together. */
export interface SkillSource {
  category: string;
  items: string[];
}

export interface SkillPlacement {
  /** Existing CV group to add to, or null when the category must be created. */
  groupId: string | null;
  category: string;
}

const lower = (s: string) => s.trim().toLowerCase();
const norm = (s: string) => lower(s).replace(/[^a-z0-9]+/g, "").replace(/s$/, "");

/**
 * Where a suggested skill belongs on this CV. Prefers the CV group that already
 * holds the skill's neighbours from the ideal CV, then a group whose name matches
 * the ideal's category, and otherwise asks for the ideal's category to be created.
 * Returns null when the skill has no category to go on.
 */
export function placeSkill(groups: SkillGroup[], source: SkillSource[], skill: string): SkillPlacement | null {
  const key = lower(skill);
  const home = source.find((g) => g.items.some((i) => lower(i) === key));
  if (!home) return null;

  const neighbours = new Set(home.items.map(lower));
  let best: SkillGroup | null = null;
  let bestCount = 0;
  for (const g of groups) {
    const count = g.items.filter((i) => neighbours.has(lower(i))).length;
    if (count > bestCount) {
      best = g;
      bestCount = count;
    }
  }
  if (best) return { groupId: best.id, category: best.category };

  const want = norm(home.category);
  if (want) {
    const named = groups.find((g) => {
      const have = norm(g.category);
      return have && (have === want || (Math.min(have.length, want.length) >= 4 && (have.includes(want) || want.includes(have))));
    });
    if (named) return { groupId: named.id, category: named.category };
  }
  return { groupId: null, category: home.category.trim() || "Skills" };
}

export interface SuggestionSection {
  key: string;
  category: string;
  /** True when accepting will create this category. */
  isNew: boolean;
  skills: string[];
}

/** Suggestions grouped by the category each will land in; uncategorised ones are kept apart. */
export function groupSuggestions(groups: SkillGroup[], source: SkillSource[], suggestions: string[]): SuggestionSection[] {
  const sections = new Map<string, SuggestionSection>();
  for (const skill of suggestions) {
    const p = placeSkill(groups, source, skill);
    const key = p ? (p.groupId ?? `new:${lower(p.category)}`) : "other";
    let sec = sections.get(key);
    if (!sec) {
      sec = { key, category: p ? p.category || "Skills" : "Other", isNew: !!p && p.groupId === null, skills: [] };
      sections.set(key, sec);
    }
    sec.skills.push(skill);
  }
  return [...sections.values()];
}

const KEEP_CATEGORY = /language|interest|hobb/i;

const mentions = (haystack: string, skill: string) => {
  const k = norm(skill);
  return k.length > 0 && haystack.includes(k);
};

/**
 * Skills on the CV the target role doesn't ask for: absent from the ideal match
 * and never named in the job description. Spoken languages and interests are
 * never flagged. Deterministic, and only a suggestion — nothing is removed for
 * the user.
 */
export function removableSkills(groups: SkillGroup[], ideal: SkillSource[], jd: string): string[] {
  if (!ideal.length && !jd.trim()) return [];
  const wanted = ideal.flatMap((g) => g.items).map(norm).filter(Boolean);
  const text = norm(jd);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of groups) {
    if (KEEP_CATEGORY.test(g.category)) continue;
    for (const raw of g.items) {
      const skill = raw.trim();
      const k = norm(skill);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      const inIdeal = wanted.some((w) => w === k || (Math.min(w.length, k.length) >= 4 && (w.includes(k) || k.includes(w))));
      if (inIdeal || mentions(text, skill)) continue;
      out.push(skill);
    }
  }
  return out;
}
