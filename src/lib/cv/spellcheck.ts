/**
 * Optional body-word spellcheck for the local coach.
 *
 * Default coach only checks the opening verb against a curated lexicon.
 * When enabled, this layer scans remaining alphabetic tokens against a compact
 * English + tech dictionary and suggests near-miss corrections.
 *
 * Not a full dictionary: acronyms, CamelCase product names, and short tokens
 * are skipped to keep noise low.
 */

import { SPELL_DICTIONARY } from "./spellDictionary";

export interface SpellIssue {
  word: string;
  suggest: string;
  dist: number;
}

/** Levenshtein edit distance (small strings; pure). */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

const TOKEN_RE = /[A-Za-z][A-Za-z']+/g;

/** Skip ALL-CAPS / short acronyms and CamelCase product tokens. */
function shouldSkipToken(raw: string): boolean {
  if (raw.length < 5) return true;
  if (/^[A-Z]{2,}$/.test(raw)) return true;
  if (/^[A-Z][a-z]+[A-Z]/.test(raw)) return true; // CamelCase
  if (raw.includes("'")) return true; // contractions — dictionary is bare stems
  return false;
}

function nearestDictionaryWord(word: string): { word: string; dist: number } | null {
  let best: { word: string; dist: number } | null = null;
  const threshold = word.length >= 8 ? 2 : 1;
  for (const v of SPELL_DICTIONARY) {
    if (Math.abs(v.length - word.length) > threshold) continue;
    const d = editDistance(word, v);
    if (d === 0) return { word: v, dist: 0 };
    if (d > threshold) continue;
    if (best === null || d < best.dist) best = { word: v, dist: d };
  }
  return best;
}

/**
 * Find likely typos in `text` (excluding the opening token when `skipFirst`).
 * Caps results to avoid flooding the coach strip.
 */
export function findSpellingIssues(
  text: string,
  opts: { skipFirst?: boolean; limit?: number } = {},
): SpellIssue[] {
  const skipFirst = opts.skipFirst ?? true;
  const limit = opts.limit ?? 2;
  const issues: SpellIssue[] = [];
  const seen = new Set<string>();

  const matches = text.matchAll(TOKEN_RE);
  let index = 0;
  for (const m of matches) {
    const raw = m[0];
    if (skipFirst && index === 0) {
      index++;
      continue;
    }
    index++;

    if (shouldSkipToken(raw)) continue;
    const word = raw.toLowerCase();
    if (seen.has(word)) continue;
    seen.add(word);
    if (SPELL_DICTIONARY.has(word)) continue;

    const near = nearestDictionaryWord(word);
    if (!near || near.dist === 0) continue;
    // Only flag when we have a confident near-miss (unknown with no neighbor stays silent).
    issues.push({ word: raw, suggest: near.word, dist: near.dist });
    if (issues.length >= limit) break;
  }

  return issues;
}
