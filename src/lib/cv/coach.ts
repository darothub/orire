/**
 * orire — inline content-quality coach (deterministic, local, no AI).
 *
 * Flags the three things that separate a strong CV bullet from a weak one, the
 * same way Rezi/Enhancv do but instantly and for free: a weak opener, a duty
 * framed as a responsibility instead of an achievement, and a result with no
 * quantified metric. Plus two cheap style nudges (first person, over-long).
 *
 * Deliberately conservative — every phrase check is anchored to the START of
 * the bullet so it doesn't fire on incidental mid-sentence words. The point is
 * a gentle nudge, not a wall of warnings, so a clean bullet returns [].
 */

export type CoachFlagId = "weak-verb" | "duty" | "no-metric" | "first-person" | "too-long";
export type CoachSeverity = "warn" | "info";

export interface CoachFlag {
  id: CoachFlagId;
  /** Short chip label. */
  label: string;
  /** One-line, actionable suggestion. */
  hint: string;
  severity: CoachSeverity;
}

/** Weak opening verbs — real work, but they undersell it. */
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

/** Duty framing — describes the remit, not the outcome. */
const DUTY_PHRASES = [
  "responsible for",
  "duties included",
  "duties include",
  "in charge of",
  "tasked with",
  "accountable for",
];

/** A digit, a percentage, a currency amount, or an "Nx" multiplier. */
const METRIC_RE = /\d|%|[$€£]|\b\d+\s*x\b/i;

/** Normalise for start-anchored matching: lowercase, strip leading bullet glyphs/space. */
function head(text: string): string {
  return text.trim().replace(/^[-–—•*\s]+/, "").toLowerCase();
}

const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

/** Analyse one highlight/bullet and return any quality flags (empty = clean). */
export function analyzeBullet(text: string): CoachFlag[] {
  const flags: CoachFlag[] = [];
  const trimmed = text.trim();
  if (!trimmed) return flags;
  const h = head(trimmed);
  const words = wordCount(trimmed);

  // Too short to meaningfully coach (a fragment, a heading) — skip the content
  // checks, which would only produce noise.
  const substantive = words >= 4;

  if (DUTY_PHRASES.some((p) => h.startsWith(p))) {
    flags.push({
      id: "duty",
      label: "Duty, not achievement",
      hint: "Lead with what you accomplished, not what you were responsible for.",
      severity: "warn",
    });
  } else if (WEAK_VERB_OPENERS.some((v) => h.startsWith(v))) {
    flags.push({
      id: "weak-verb",
      label: "Weak opener",
      hint: "Open with a strong action verb — Led, Built, Shipped, Drove, Cut.",
      severity: "warn",
    });
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

/** Count of bullets across experience/projects that have at least one `warn` flag. */
export function coachWarningCount(bullets: string[]): number {
  return bullets.filter((b) => analyzeBullet(b).some((f) => f.severity === "warn")).length;
}
