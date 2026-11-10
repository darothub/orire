/**
 * orire — CV refinement agents.
 *
 * Under fact-grounding a rewriter can only reword what is already on the page,
 * so the gap to the "ideal candidate" is closed by ELICITING real facts from the
 * candidate, not by better prose. Pipeline:
 *   1. Analyst    — job description → ideal-candidate profile.
 *   2. Gap finder — CV vs profile → matched / understated / plausible / genuine gap.
 *   3. Elicitor   — turns the closeable gaps into ≤6 targeted questions (the one
 *                   human pause; answers become new grounded facts).
 *   4. Rewriter   — wording-only patch using the CV plus the candidate's answers.
 *   5. Critic     — skeptical recruiter + ATS parser reviewing the draft; its
 *                   specific rejections feed the rewriter for another pass.
 *   6. Fact guard — deterministic (guardrails.ts), never an LLM.
 *   7. ATS check  — deterministic keyword coverage before vs after (jdmatch.ts).
 *
 * Every agent output is untrusted and sanitized here.
 */

import type { CVData } from "@/lib/cv/schema";
import { indexedSource, PATCH_SCHEMA_HINT } from "@/lib/ai/prompt";
import { parseModelJSON } from "@/lib/ai/guardrails";

export interface IdealProfile {
  roleTitle: string;
  seniority: string;
  mustHaves: string[];
  niceToHaves: string[];
  keywords: string[];
  tone: string;
}

export interface GapItem {
  area: string;
  advice: string;
}

export interface WeakBullet {
  kind: "experience" | "project";
  ref: number;
  issue: string;
}

export interface GapReport {
  /** Requirements the CV already demonstrates well. */
  matched: string[];
  /** The candidate has it, but the CV buries or mis-words it. */
  understated: GapItem[];
  /** Likely true but not on the CV — worth asking about. */
  plausible: GapItem[];
  /** Not present. Reported honestly, never faked. */
  genuineGap: GapItem[];
  weakBullets: WeakBullet[];
}

export type QuestionKind = "metric" | "scope" | "outcome" | "keyword-confirm";

export interface ElicitationQuestion {
  id: string;
  /** The requirement or CV entry this question tries to close. */
  targets: string;
  prompt: string;
  kind: QuestionKind;
}

export interface ElicitedAnswer {
  questionId: string;
  question: string;
  answer: string;
}

export interface CritiqueIssue {
  kind: "experience" | "project" | "summary" | "general";
  /** Entry index for experience/project issues, bounds-checked. */
  ref?: number;
  problem: string;
  fix: string;
}

export interface Critique {
  recruiter: { issues: CritiqueIssue[]; keepGoing: boolean };
  ats: { missingKeywords: string[]; parseRisks: string[]; keepGoing: boolean };
}

export const MAX_QUESTIONS = 6;
/** Critic→rewriter feedback rounds after the first draft. */
export const MAX_CRITIC_ROUNDS = 2;
const LIST_MAX = 12;
const TEXT_MAX = 300;
export const ANSWER_MAX = 600;

const str = (v: unknown, max = TEXT_MAX) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strList = (v: unknown, max = LIST_MAX) =>
  Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean).slice(0, max) : [];
const objList = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x)) : [];

/* ---------------------------- Agent 1: analyst --------------------------- */

export const ANALYST_SYSTEM = `You are a senior recruiter. You read a job description and describe the IDEAL candidate for it.

RULES:
- Base everything ONLY on the job description. Do not invent requirements.
- Separate hard requirements ("mustHaves") from bonuses ("niceToHaves").
- "keywords" are the exact skills/tools/terms an applicant tracking system would scan for.
- Output valid JSON only, no prose.`;

export function buildAnalystPrompt(jobDescription: string): string {
  return [
    "JOB DESCRIPTION:",
    "```",
    jobDescription.trim(),
    "```",
    "",
    `Return ONLY this JSON shape:
{
  "roleTitle": string,
  "seniority": string,
  "mustHaves": [string],
  "niceToHaves": [string],
  "keywords": [string],
  "tone": string   // e.g. "technical and metrics-driven"
}`,
  ].join("\n");
}

/** Sanitize an untrusted profile object (model output or client-echoed state). */
export function sanitizeProfile(o: Record<string, unknown>): IdealProfile {
  return {
    roleTitle: str(o.roleTitle, 120),
    seniority: str(o.seniority, 80),
    mustHaves: strList(o.mustHaves),
    niceToHaves: strList(o.niceToHaves),
    keywords: strList(o.keywords, 30),
    tone: str(o.tone, 120),
  };
}

export const parseIdealProfile = (raw: string): IdealProfile => sanitizeProfile(parseModelJSON(raw));

/* --------------------------- Agent 2: gap finder -------------------------- */

export const GAP_SYSTEM = `You are a candid career coach. You compare a CV with an ideal-candidate profile and bucket every requirement.

BUCKETS:
- matched: the CV already demonstrates it well.
- understated: the CV shows related work but buries it, words it vaguely, or omits the scale/result.
- plausible: someone with this CV has likely done it, but it is not stated.
- genuineGap: nothing in the CV suggests it. Say so plainly — never suggest faking it.

RULES:
- Judge ONLY what is in the CV. Never assume or invent experience.
- Flag weak bullets (vague, duty-only, no outcome) by their [#index].
- Be specific and brief. Output valid JSON only, no prose.`;

export function buildGapPrompt(cv: CVData, profile: IdealProfile): string {
  return [
    "IDEAL CANDIDATE PROFILE:",
    "```json",
    JSON.stringify(profile, null, 2),
    "```",
    "",
    "CV:",
    indexedSource(cv),
    "",
    `Return ONLY this JSON shape:
{
  "matched": [string],
  "understated": [{ "area": string, "advice": string }],
  "plausible": [{ "area": string, "advice": string }],
  "genuineGap": [{ "area": string, "advice": string }],
  "weakBullets": [{ "kind": "experience"|"project", "ref": number, "issue": string }]
}`,
  ].join("\n");
}

const gapItems = (v: unknown): GapItem[] =>
  objList(v)
    .map((g) => ({ area: str(g.area, 120), advice: str(g.advice) }))
    .filter((g) => g.area)
    .slice(0, LIST_MAX);

/** Sanitize an untrusted gap report; weak-bullet refs are bounds-checked against the CV. */
export function sanitizeGapReport(o: Record<string, unknown>, cv: CVData): GapReport {
  const weakBullets: WeakBullet[] = objList(o.weakBullets)
    .map((w) => ({
      kind: w.kind === "project" ? ("project" as const) : ("experience" as const),
      ref: Number(w.ref),
      issue: str(w.issue),
    }))
    .filter((w) => {
      const max = w.kind === "project" ? cv.projects.length : cv.experience.length;
      return Number.isInteger(w.ref) && w.ref >= 0 && w.ref < max && w.issue;
    })
    .slice(0, 20);
  return {
    matched: strList(o.matched),
    understated: gapItems(o.understated),
    plausible: gapItems(o.plausible),
    genuineGap: gapItems(o.genuineGap),
    weakBullets,
  };
}

export const parseGapReport = (raw: string, cv: CVData): GapReport => sanitizeGapReport(parseModelJSON(raw), cv);

/* ---------------------------- Agent 3: elicitor --------------------------- */

export const ELICITOR_SYSTEM = `You are an interviewer helping a candidate recall real achievements that their CV leaves out.

RULES:
- Ask at most ${MAX_QUESTIONS} questions, ordered by how much answering would help the candidate match the job.
- Only target the "understated" and "plausible" items and the weak bullets. Never ask about genuine gaps.
- Each question must be concrete and tied to something on the CV or a named requirement, e.g. "You list 'improved API latency' — by how much, measured how, against what baseline?".
- Never suggest an answer or imply the candidate has experience they did not state. Ask neutrally.
- kind is one of: "metric" (a number), "scope" (team/users/budget size), "outcome" (what changed), "keyword-confirm" (did you use X?).
- Output valid JSON only, no prose.`;

export function buildElicitorPrompt(cv: CVData, profile: IdealProfile, report: GapReport): string {
  return [
    "CV:",
    indexedSource(cv),
    "",
    "IDEAL CANDIDATE PROFILE:",
    "```json",
    JSON.stringify(profile, null, 2),
    "```",
    "",
    "GAP REPORT:",
    "```json",
    JSON.stringify(report, null, 2),
    "```",
    "",
    `Return ONLY this JSON shape:
{ "questions": [{ "targets": string, "prompt": string, "kind": "metric"|"scope"|"outcome"|"keyword-confirm" }] }`,
  ].join("\n");
}

const KINDS: QuestionKind[] = ["metric", "scope", "outcome", "keyword-confirm"];

/** Ids are assigned here (q1, q2…), never taken from the model. */
export function parseQuestions(raw: string): ElicitationQuestion[] {
  const o = parseModelJSON(raw);
  return objList(o.questions)
    .map((q) => ({
      targets: str(q.targets, 120),
      prompt: str(q.prompt, 400),
      kind: (KINDS.includes(q.kind as QuestionKind) ? q.kind : "outcome") as QuestionKind,
    }))
    .filter((q) => q.prompt)
    .slice(0, MAX_QUESTIONS)
    .map((q, i) => ({ id: `q${i + 1}`, ...q }));
}

/** Keep only non-empty answers, bounded in count and length. */
export function sanitizeAnswers(v: unknown): ElicitedAnswer[] {
  return objList(v)
    .map((a) => ({ questionId: str(a.questionId, 20), question: str(a.question, 400), answer: str(a.answer, ANSWER_MAX) }))
    .filter((a) => a.questionId && a.answer)
    .slice(0, MAX_QUESTIONS);
}

/* ---------------------------- Agent 4: rewriter --------------------------- */

export const REWRITER_SYSTEM = `You are a meticulous CV editor moving a CV closer to an ideal-candidate profile.

You receive the SOURCE CV (entries numbered [#n]), the ideal profile, a gap report and, when present, the CANDIDATE'S OWN ANSWERS to follow-up questions. Return ONLY a compact JSON patch.

ABSOLUTE RULES (fact-grounding):
- The only allowed facts are the source CV and the candidate's answers. NEVER invent or alter employers, titles, dates, locations, degrees, institutions, certifications, project names, metrics or numbers, and NEVER add skills the person did not list or confirm.
- Use a number only if it appears verbatim in the source CV or the answers. Never estimate, round or combine figures.
- Fold an answer into the highlight of the entry it clearly concerns; if you cannot tell which entry, leave it out.
- Fix flagged weak bullets: lead with a strong verb and make the outcome clear.
- When a REVIEWER FEEDBACK section is present, address each issue it raises, but a fix that would need a fact or number not in the source or answers must be ignored. Never add a missing keyword the CV and answers do not support.
- Where the source and the profile name the SAME existing skill differently, use the profile's wording. Do NOT add a requirement the CV and answers do not demonstrate — leave real gaps as gaps.
- Reference entries by "ref". Do not emit company names, dates, emails, phone numbers or URLs.
- Output valid JSON only, no prose.`;

export function buildRewriterPrompt(
  cv: CVData,
  jobDescription: string,
  profile: IdealProfile,
  report: GapReport,
  answers: ElicitedAnswer[] = [],
  feedback?: { critique: Critique; previousDraft: CVData },
): string {
  return [
    "SOURCE CV (allowed source of facts):",
    indexedSource(cv),
    "",
    ...(answers.length
      ? [
          "CANDIDATE'S OWN ANSWERS (also allowed facts):",
          answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n"),
          "",
        ]
      : []),
    "IDEAL CANDIDATE PROFILE:",
    "```json",
    JSON.stringify(profile, null, 2),
    "```",
    "",
    "GAP REPORT:",
    "```json",
    JSON.stringify(report, null, 2),
    "```",
    "",
    ...(feedback
      ? [
          "PREVIOUS DRAFT (to improve; entries use the same [#n] numbering):",
          indexedSource(feedback.previousDraft),
          "",
          "REVIEWER FEEDBACK:",
          "```json",
          JSON.stringify(feedback.critique, null, 2),
          "```",
          "",
        ]
      : []),
    "TARGET JOB DESCRIPTION:",
    "```",
    jobDescription.trim(),
    "```",
    "",
    "Produce a wording-only patch that addresses the weak bullets, surfaces existing strengths and uses the candidate's answers. Obey every fact-grounding rule.",
    PATCH_SCHEMA_HINT,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/* ----------------------------- Agent 5: critic ---------------------------- */

export const CRITIC_SYSTEM = `You are two reviewers in one pass, judging a tailored CV draft against a job.

1. A skeptical recruiter: is each bullet specific, outcome-driven and relevant, and does the seniority fit the role?
2. An ATS parser: are the role's exact keywords present, and is anything likely to parse badly?

RULES:
- Be specific and addressable: name the entry by its [#n] index and say exactly what to change.
- A fix may only reword what is already on the page. If the fix would need a fact the candidate has not given, do not propose it.
- Do not demand keywords that the CV does not support; list them under missingKeywords only if the CV plausibly already covers them in other words.
- Set keepGoing=false for a reviewer when remaining issues are minor or cannot be fixed by rewording.
- Output valid JSON only, no prose.`;

export function buildCriticPrompt(draft: CVData, profile: IdealProfile, missingKeywords: string[]): string {
  return [
    "DRAFT CV:",
    indexedSource(draft),
    "",
    "IDEAL CANDIDATE PROFILE:",
    "```json",
    JSON.stringify(profile, null, 2),
    "```",
    "",
    `Keywords from the job not found in the draft (deterministic check): ${missingKeywords.join(", ") || "none"}`,
    "",
    `Return ONLY this JSON shape:
{
  "recruiter": { "issues": [{ "kind": "experience"|"project"|"summary"|"general", "ref": number, "problem": string, "fix": string }], "keepGoing": boolean },
  "ats": { "missingKeywords": [string], "parseRisks": [string], "keepGoing": boolean }
}`,
  ].join("\n");
}

/** Sanitize an untrusted critique (model output or client-echoed feedback). */
export function sanitizeCritique(o: Record<string, unknown>, cv: CVData): Critique {
  const rec = (o.recruiter && typeof o.recruiter === "object" ? o.recruiter : {}) as Record<string, unknown>;
  const ats = (o.ats && typeof o.ats === "object" ? o.ats : {}) as Record<string, unknown>;
  const issues: CritiqueIssue[] = objList(rec.issues)
    .map((i) => {
      const kind = (["experience", "project", "summary", "general"].includes(i.kind as string) ? i.kind : "general") as CritiqueIssue["kind"];
      const ref = Number(i.ref);
      const max = kind === "project" ? cv.projects.length : cv.experience.length;
      const hasRef = (kind === "experience" || kind === "project") && Number.isInteger(ref) && ref >= 0 && ref < max;
      return { kind, ...(hasRef ? { ref } : {}), problem: str(i.problem), fix: str(i.fix) };
    })
    .filter((i) => i.problem)
    .slice(0, 10);
  return {
    recruiter: { issues, keepGoing: rec.keepGoing === true && issues.length > 0 },
    ats: {
      missingKeywords: strList(ats.missingKeywords, 20),
      parseRisks: strList(ats.parseRisks, 8),
      keepGoing: ats.keepGoing === true,
    },
  };
}

export const parseCritique = (raw: string, cv: CVData): Critique => sanitizeCritique(parseModelJSON(raw), cv);

/**
 * Loop controller: another rewrite pass is worthwhile only while a reviewer
 * still wants changes AND the budget remains. `round` is the number of
 * feedback rewrites already done.
 */
export function shouldContinue(critique: Critique, round: number): boolean {
  if (round >= MAX_CRITIC_ROUNDS) return false;
  return critique.recruiter.keepGoing || (critique.ats.keepGoing && critique.ats.missingKeywords.length > 0);
}
