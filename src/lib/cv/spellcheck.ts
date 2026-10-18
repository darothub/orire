/**
 * Optional body-word spellcheck for the local coach.
 *
 * Default coach only checks the opening verb against a curated lexicon.
 * When enabled, this layer scans remaining alphabetic tokens against a compact
 * English + tech dictionary and suggests near-miss corrections.
 *
 * Accuracy model (intentionally non-contextual):
 *   - No sentence grammar or POS — membership + morphology + edit distance only.
 *   - Unknown tokens are accepted when they are regular forms of a known stem
 *     (plurals, -ing/-ed/-ly/-able/-ive/…).
 *   - Typos are flagged only on a single-edit near miss (distance 1). Distance-2
 *     matches were too noisy ("responsive" → "response").
 *   - Unknown with no distance-1 neighbor stays silent (better miss than false hit).
 *
 * Not a full dictionary: acronyms, CamelCase product names, and short tokens
 * are skipped.
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

/** Common English suffixes (longest first) for stem acceptance. */
const SUFFIXES = [
  "ational",
  "ization",
  "isation",
  "izations",
  "isations",
  "fulness",
  "ousness",
  "ability",
  "ibility",
  "ations",
  "ation",
  "ition",
  "ments",
  "ment",
  "nesses",
  "ness",
  "ingly",
  "edly",
  "ally",
  "ially",
  "ically",
  "ously",
  "ively",
  "ably",
  "ibly",
  "izing",
  "ising",
  "ized",
  "ised",
  "izes",
  "ises",
  "ize",
  "ise",
  "able",
  "ible",
  "ives",
  "ive",
  "ous",
  "ful",
  "less",
  "ers",
  "est",
  "ing",
  "ies",
  "ied",
  "ed",
  "ly",
  "er",
  "es",
  "s",
] as const;

/** Skip ALL-CAPS / short acronyms and CamelCase product tokens. */
function shouldSkipToken(raw: string): boolean {
  if (raw.length < 5) return true;
  if (/^[A-Z]{2,}$/.test(raw)) return true;
  if (/^[A-Z][a-z]+[A-Z]/.test(raw)) return true; // CamelCase
  if (raw.includes("'")) return true; // contractions — dictionary is bare stems
  return false;
}

/**
 * True when `word` is in the lexicon or a regular morphological form of a
 * lexicon entry (plural / common suffix). Avoids flagging "millions",
 * "responsive", "maintainable" just because only the stem was listed.
 */
export function isKnownOrDerived(word: string): boolean {
  if (SPELL_DICTIONARY.has(word)) return true;

  // Straight plural of a known word.
  if (word.endsWith("ies") && word.length > 5) {
    const y = word.slice(0, -3) + "y";
    if (SPELL_DICTIONARY.has(y)) return true;
  }
  if (word.endsWith("es") && word.length > 4) {
    if (SPELL_DICTIONARY.has(word.slice(0, -2))) return true;
    if (SPELL_DICTIONARY.has(word.slice(0, -1))) return true;
  }
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 4) {
    if (SPELL_DICTIONARY.has(word.slice(0, -1))) return true;
  }

  for (const suf of SUFFIXES) {
    if (!word.endsWith(suf) || word.length <= suf.length + 3) continue;
    const stem = word.slice(0, -suf.length);
    if (SPELL_DICTIONARY.has(stem)) return true;
    // response + ive ← respons + e
    if (SPELL_DICTIONARY.has(stem + "e")) return true;
    // double consonant before -ing/-ed: running → run
    if (
      (suf === "ing" || suf === "ed") &&
      stem.length >= 2 &&
      stem[stem.length - 1] === stem[stem.length - 2] &&
      SPELL_DICTIONARY.has(stem.slice(0, -1))
    ) {
      return true;
    }
    if (stem.endsWith("i") && SPELL_DICTIONARY.has(stem.slice(0, -1) + "y")) return true;
  }

  return false;
}

/**
 * Single-edit near miss only. Distance 2 produced false friends
 * (responsive→response, maintainable→maintenance).
 */
function nearestDictionaryWord(word: string): { word: string; dist: number } | null {
  let best: { word: string; dist: number } | null = null;
  const threshold = 1;
  for (const v of SPELL_DICTIONARY) {
    if (Math.abs(v.length - word.length) > threshold) continue;
    const d = editDistance(word, v);
    if (d === 0) return { word: v, dist: 0 };
    if (d > threshold) continue;
    if (
      best === null ||
      d < best.dist ||
      (d === best.dist && v.length === word.length && best.word.length !== word.length)
    ) {
      // Prefer same-length candidates when tied (paymants→payments over payment).
      if (best && d === best.dist && v.length !== word.length && best.word.length === word.length) {
        continue;
      }
      best = { word: v, dist: d };
    }
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
    if (isKnownOrDerived(word)) continue;

    const near = nearestDictionaryWord(word);
    if (!near || near.dist !== 1) continue;
    issues.push({ word: raw, suggest: near.word, dist: near.dist });
    if (issues.length >= limit) break;
  }

  return issues;
}
