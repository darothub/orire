/**
 * orire — cover letter generation (CL-1).
 *
 * Builds the system + user prompts and coerces the model's JSON into a
 * {@link CoverLetter}. The letter is fact-grounded on the candidate's CV: the
 * model restructures and phrases existing facts for a specific job, and must
 * not invent new ones. Provider errors are surfaced verbatim by the route.
 */

import type { CVData } from "@/lib/cv/schema";
import { indexedSource } from "@/lib/ai/prompt";
import { parseModelJSON } from "@/lib/ai/guardrails";
import { type CoverLetter, emptyCoverLetter } from "@/lib/cv/coverLetter";

export type CoverLetterTone = "professional" | "warm" | "confident" | "concise";

export const COVER_LETTER_SYSTEM = `You are an expert career writer who drafts sharp, specific, modern cover letters.

ABSOLUTE RULES:
- Ground every claim ONLY in the candidate facts provided. Do NOT invent employers, titles, dates, metrics, tools, or achievements that are not in the facts.
- Tailor the letter to the target job: mirror its priorities and language using the candidate's REAL experience and skills.
- Be concrete and results-oriented. Prefer specific accomplishments over generic enthusiasm. No clichés ("team player", "hit the ground running", "passionate about leveraging synergies").
- Keep it tight: an opening hook, 2–3 body paragraphs, and a confident close. Roughly 250–350 words total.
- Use plain professional prose. No markdown, no bullet lists, no headings inside the letter body.
- If the job description names a company, role, or hiring manager, use them; otherwise leave that field empty (do not guess a company name).

OUTPUT: Return ONLY a JSON object with exactly this shape (no markdown, no commentary):
{
  "meta": { "role": string, "company": string, "hiringManager": string },
  "opening": string,
  "body": [string],
  "closing": string,
  "signoff": string
}`;

export function buildCoverLetterPrompt(
  cv: CVData,
  jobDescription: string,
  opts: { tone?: CoverLetterTone } = {}
): string {
  const tone = opts.tone ?? "professional";
  return [
    "TARGET JOB DESCRIPTION:",
    "```",
    jobDescription.trim(),
    "```",
    "",
    "CANDIDATE FACTS (the ONLY source of truth — do not add anything not present here):",
    "```",
    indexedSource(cv),
    "```",
    "",
    `TONE: ${tone}.`,
    "Write a cover letter addressed to the hiring team for the role above, drawing exclusively on the candidate facts. Return the JSON object described in the system message.",
  ].join("\n");
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Coerce raw model output into a well-formed {@link CoverLetter}. */
export function coerceCoverLetter(raw: string): CoverLetter {
  const o = parseModelJSON(raw);
  const meta = (o.meta && typeof o.meta === "object" ? o.meta : {}) as Record<string, unknown>;

  let body: string[];
  if (Array.isArray(o.body)) {
    body = o.body.map(asStr).filter(Boolean);
  } else {
    body = asStr(o.body)
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  const out = emptyCoverLetter();
  out.meta = {
    role: asStr(meta.role),
    company: asStr(meta.company),
    hiringManager: asStr(meta.hiringManager) || undefined,
  };
  out.opening = asStr(o.opening);
  out.body = body;
  out.closing = asStr(o.closing);
  out.signoff = asStr(o.signoff) || "Sincerely,";
  return out;
}
