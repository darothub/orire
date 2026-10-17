/**
 * orire — inline content-quality coach (deterministic, local, no AI).
 *
 * The instant, high-precision layer of the quality coach. It flags the things a
 * static check can do well and cheaply:
 *   - weak opener (Helped, Worked on…) and duty framing (Responsible for…)
 *   - a likely MISSPELLED opening verb — not via a megabyte dictionary, but by
 *     edit-distance against a curated action-verb lexicon ("Comtributed" is one
 *     edit from "Contributed")
 *   - an opener that isn't a recognized CV action verb at all ("Colonised")
 *   - no quantified result, first person, over-long
 *
 * It deliberately judges only the OPENING VERB for the verb checks (that's where
 * false positives are lowest and signal is highest), and stays silent on a clean
 * bullet. Deeper, context-aware judgement (full-sentence relevance, grammar) is
 * the on-demand AI review's job — see lib/ai/bulletReview.ts.
 */

export type CoachFlagId = "weak-verb" | "duty" | "typo" | "odd-verb" | "no-metric" | "first-person" | "too-long";
export type CoachSeverity = "warn" | "info";

export interface CoachFlag {
  id: CoachFlagId;
  label: string;
  hint: string;
  severity: CoachSeverity;
  /** For `typo`: the suggested correct opener (lowercase). */
  suggest?: string;
}

const WEAK_VERB_OPENERS = [
  "helped",
  "assisted",
  "worked on",
  "worked with",
  "participated in",
  "involved in",
  "contributed to",
  "supported",
];

const DUTY_PHRASES = [
  "responsible for",
  "duties included",
  "duties include",
  "in charge of",
  "tasked with",
  "accountable for",
];

/**
 * Curated CV action-verb lexicon (correctly spelled, British + American where
 * they differ). Used two ways: an opener in here is accepted; an opener NOT in
 * here is checked for a near miss (typo) and otherwise flagged as unusual. Kept
 * generous to keep the "unusual opener" nudge low-noise.
 */
const ACTION_VERBS = new Set([
  "led","built","created","designed","developed","delivered","drove","launched","shipped","managed","owned","ran",
  "headed","directed","oversaw","founded","established","introduced","launched","spearheaded","pioneered","initiated",
  "improved","increased","boosted","grew","raised","accelerated","maximized","maximised","optimized","optimised",
  "reduced","cut","lowered","decreased","minimized","minimised","saved","streamlined","simplified","consolidated",
  "automated","architected","engineered","implemented","deployed","integrated","migrated","refactored","rebuilt",
  "redesigned","modernized","modernised","scaled","standardized","standardised","configured","maintained","debugged",
  "resolved","diagnosed","tested","documented","shipped","released","analyzed","analysed","researched","modeled",
  "modelled","forecasted","measured","evaluated","audited","validated","mentored","coached","trained","led",
  "coordinated","collaborated","partnered","negotiated","presented","communicated","facilitated","organized",
  "organised","planned","prioritized","prioritised","scheduled","budgeted","forecast","secured","won","closed",
  "generated","produced","wrote","authored","published","edited","translated","taught","advised","consulted",
  "supervised","hired","recruited","onboarded","promoted","transformed","overhauled","revamped","championed",
  "drove","handled","administered","operated","executed","achieved","exceeded","surpassed","earned","awarded",
]);

/**
 * Broader known-verb vocabulary for membership + typo matching: the action
 * verbs plus common/weak verbs. A typo like "comtributed" matches "contributed"
 * here; a recognized (if weak) verb isn't flagged as an unusual opener.
 */
const VERB_VOCAB = new Set<string>([
  ...ACTION_VERBS,
  "helped","assisted","contributed","supported","worked","participated","involved","handled","used","made","updated","created",
]);

/** A digit, a percentage, a currency amount, or an "Nx" multiplier. */
const METRIC_RE = /\d|%|[$€£]|\b\d+\s*x\b/i;

/** Normalise for start-anchored matching: lowercase, strip leading bullet glyphs/space. */
function head(text: string): string {
  return text.trim().replace(/^[-–—•*\s]+/, "").toLowerCase();
}

const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

const cap = (w: string): string => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w);

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

/** Nearest action verb to `word`, or null if none is within a sensible bound. */
function nearestActionVerb(word: string): { word: string; dist: number } | null {
  let best: { word: string; dist: number } | null = null;
  for (const v of VERB_VOCAB) {
    if (Math.abs(v.length - word.length) > 2) continue;
    const d = editDistance(word, v);
    if (best === null || d < best.dist) best = { word: v, dist: d };
    if (d === 0) break;
  }
  return best;
}

/** Analyse one highlight/bullet and return any quality flags (empty = clean). */
export function analyzeBullet(text: string): CoachFlag[] {
  const flags: CoachFlag[] = [];
  const trimmed = text.trim();
  if (!trimmed) return flags;
  const h = head(trimmed);
  const words = wordCount(trimmed);
  const substantive = words >= 4;

  // --- Opener: duty / weak phrase, else verb strength + spelling. ---
  let openerFlagged = false;
  if (DUTY_PHRASES.some((p) => h.startsWith(p))) {
    flags.push({
      id: "duty",
      label: "Duty, not achievement",
      hint: "Lead with what you accomplished, not what you were responsible for.",
      severity: "warn",
    });
    openerFlagged = true;
  } else if (WEAK_VERB_OPENERS.some((v) => h.startsWith(v))) {
    flags.push({
      id: "weak-verb",
      label: "Weak opener",
      hint: "Open with a strong action verb — Led, Built, Shipped, Drove, Cut.",
      severity: "warn",
    });
    openerFlagged = true;
  }

  // The first token, letters only — but skip compounds/hyphenated/non-alpha.
  const firstTokenRaw = h.split(/\s+/)[0] ?? "";
  const opener = /^[a-z]+$/.test(firstTokenRaw) ? firstTokenRaw : "";
  if (!openerFlagged && opener.length >= 4 && !VERB_VOCAB.has(opener)) {
    const near = nearestActionVerb(opener);
    const threshold = opener.length >= 7 ? 2 : 1;
    if (near && near.dist > 0 && near.dist <= threshold) {
      flags.push({
        id: "typo",
        label: "Possible typo",
        hint: `“${cap(opener)}” looks misspelled — did you mean “${cap(near.word)}”?`,
        severity: "warn",
        suggest: near.word,
      });
    } else {
      flags.push({
        id: "odd-verb",
        label: "Unusual opener",
        hint: "This isn’t a standard CV action verb — try Led, Built, Drove, Delivered…",
        severity: "info",
      });
    }
  }

  if (substantive && !METRIC_RE.test(trimmed)) {
    flags.push({
      id: "no-metric",
      label: "No metric",
      hint: "Quantify the impact — a number, %, amount or time saved.",
      severity: "info",
    });
  }

  if (/(^|\s)(i|i'm|i've|my)\b/.test(` ${h} `)) {
    flags.push({
      id: "first-person",
      label: "First person",
      hint: "CV bullets drop “I/my” — start straight with the action verb.",
      severity: "warn",
    });
  }

  if (words > 32) {
    flags.push({
      id: "too-long",
      label: "Too long",
      hint: "Tighten to one idea — aim for a single readable line.",
      severity: "info",
    });
  }

  return flags;
}

/** Count of bullets that have at least one `warn` flag. */
export function coachWarningCount(bullets: string[]): number {
  return bullets.filter((b) => analyzeBullet(b).some((f) => f.severity === "warn")).length;
}
