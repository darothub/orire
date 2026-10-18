/**
 * orire — on-demand AI quality review for a single CV bullet.
 *
 * The deterministic coach (lib/cv/coach.ts) is the instant, high-precision
 * "obvious wins" layer. This is the semantic layer it can't be: judging whether
 * a verb is strong AND relevant in context, catching typos and vagueness, and
 * proposing a concrete rewrite — the things a static word list fundamentally
 * can't do. Runs only when the user asks (a button), never per keystroke.
 *
 * Fact-grounded: the model is told to reuse only the facts already in the
 * bullet and never invent a metric; the route additionally discards a
 * suggestion that introduces a number absent from the original (see route).
 */

import { parseModelJSON } from "@/lib/ai/guardrails";

export type BulletVerdict = "strong" | "ok" | "weak";

export interface BulletIssue {
  /** Short machine type, e.g. "weak-verb" | "irrelevant" | "typo" | "vague" | "no-metric" | "duty". */
  type: string;
  /** One-line, human explanation. */
  message: string;
}

export interface BulletReview {
  verdict: BulletVerdict;
  issues: BulletIssue[];
  /** An improved rewrite of the same facts, or "" when nothing to improve. */
  suggestion: string;
}

export const BULLET_REVIEW_SYSTEM = `You are a precise CV/résumé line editor. You review ONE bullet point in full-sentence context and judge its quality for a professional CV.

Assess (use the whole bullet — never flag a real word just because it resembles another):
- Spelling & grammar in context: only mark true typos or grammar errors that change meaning or look wrong in THIS sentence. Do not "correct" valid plurals, adjectives, or technical terms (e.g. millions, responsive, maintainable, Kotlin, Jetpack) into shorter unrelated words.
- Verb: is the opening verb a strong, appropriate action verb — not weak ("helped", "worked on"), not a duty framing ("responsible for"), and not an odd/irrelevant word for a professional CV?
- Impact: is there a concrete, quantified result (number, %, amount, time)? Flag if vague.
- Concision & coherence: one clear idea; flag awkward repetition or broken phrasing.

Rules:
- Judge ONLY this bullet. Do not invent facts, employers, metrics or numbers that are not already present. A rewrite must preserve the original facts and add NO new numbers.
- When fixing spelling, prefer the minimal edit that keeps the author's meaning.
- If the bullet is already strong, return an empty issues array and an empty suggestion.
- Issue types may include: "typo" | "grammar" | "weak-verb" | "duty" | "vague" | "no-metric" | "irrelevant" | "other".

Return ONLY this JSON (no markdown, no prose):
{
  "verdict": "strong" | "ok" | "weak",
  "issues": [{ "type": string, "message": string }],
  "suggestion": string
}`;

export function buildBulletReviewPrompt(text: string, role?: string): string {
  const ctx = role?.trim() ? `Role/context: ${role.trim()}\n` : "";
  return `${ctx}Bullet to review:\n"""${text.trim()}"""\n\nReturn the JSON review.`;
}

const VERDICTS: BulletVerdict[] = ["strong", "ok", "weak"];

/** Parse + clamp a model review. Never throws; coerces to a safe shape. */
export function parseBulletReview(raw: string): BulletReview {
  const obj = parseModelJSON(raw) as Record<string, unknown>;
  const verdict = VERDICTS.includes(obj.verdict as BulletVerdict) ? (obj.verdict as BulletVerdict) : "ok";
  const issues: BulletIssue[] = Array.isArray(obj.issues)
    ? obj.issues
        .map((i): BulletIssue | null => {
          const o = i as Record<string, unknown>;
          const message = typeof o?.message === "string" ? o.message.trim() : "";
          if (!message) return null;
          return { type: typeof o?.type === "string" ? o.type : "other", message };
        })
        .filter((x): x is BulletIssue => x !== null)
        .slice(0, 6)
    : [];
  const suggestion = typeof obj.suggestion === "string" ? obj.suggestion.trim() : "";
  return { verdict, issues, suggestion };
}

/** The set of numeric tokens in a string (digits only), for the grounding guard. */
export function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(/[.,]$/, ""));
}

/**
 * Drop a suggestion that introduces a number not present in the original — the
 * fact-grounding guard, so the review can never invent a metric. Returns the
 * suggestion, or "" if it added a number.
 */
export function groundSuggestion(original: string, suggestion: string): string {
  if (!suggestion) return "";
  const have = new Set(numbersIn(original));
  const invented = numbersIn(suggestion).some((n) => !have.has(n));
  return invented ? "" : suggestion;
}
