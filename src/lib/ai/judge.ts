/**
 * orire — LLM-as-judge (req 7).
 *
 * After two providers each return a fact-grounded CV, an impartial judge model
 * scores them against the job description and picks a winner. The judge only
 * evaluates — it never emits CV content — so its output needs validation
 * (numeric clamping, valid winner) but not fact-grounding.
 */

import type { CVData } from "@/lib/cv/schema";
import { parseModelJSON } from "@/lib/ai/guardrails";

export interface JudgeCandidate {
  id: string;
  label: string;
  cv: CVData;
}

export interface JudgeScore {
  id: string;
  relevance: number;
  impact: number;
  coverage: number;
  conciseness: number;
  overall: number;
  rationale: string;
}

export interface JudgeVerdict {
  scores: JudgeScore[];
  winner: string;
  reasoning: string;
}

export const JUDGE_SYSTEM = `You are an impartial senior hiring reviewer. You compare tailored CVs against a job description and judge which best fits the role.

RULES:
- Judge ONLY on how well each CV matches the job description: relevance of experience, demonstrated impact and clarity, coverage of the role's requirements, and conciseness.
- Do NOT reward invented or exaggerated claims. If a CV appears to overstate, score it lower on impact.
- Be decisive: pick a single winner.
- Output valid JSON only, no prose outside the JSON.`;

const JUDGE_SCHEMA = `Return ONLY this JSON shape:
{
  "scores": [
    { "id": string, "relevance": 0-100, "impact": 0-100, "coverage": 0-100, "conciseness": 0-100, "overall": 0-100, "rationale": string }
  ],
  "winner": string,   // must equal one of the candidate ids
  "reasoning": string // one short paragraph explaining the verdict
}`;

export function buildJudgePrompt(jobDescription: string, candidates: JudgeCandidate[]): string {
  const blocks = candidates
    .map(
      (c) =>
        `CANDIDATE id="${c.id}" (${c.label}):\n\`\`\`json\n${JSON.stringify(canonicalCV(c.cv), null, 2)}\n\`\`\``
    )
    .join("\n\n");
  return [
    "TARGET JOB DESCRIPTION:",
    "```",
    jobDescription.trim(),
    "```",
    "",
    `There are ${candidates.length} candidate CVs. Candidate ids: ${candidates.map((c) => `"${c.id}"`).join(", ")}.`,
    "",
    blocks,
    "",
    "Score each candidate and choose the single best match for the job.",
    JUDGE_SCHEMA,
  ].join("\n");
}

/**
 * Strip volatile, non-semantic fields (internal item `id`s) so the judge sees
 * only content. `factGround` re-ids CV items on every refine pass, which would
 * otherwise change the judge prompt — and any determinism cache key — even when
 * the actual CV content is identical.
 */
export function canonicalCV(cv: CVData): unknown {
  return stripIds(cv);
}
function stripIds(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripIds);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (k === "id") continue;
      out[k] = stripIds(val);
    }
    return out;
  }
  return v;
}

/** Deterministic JSON with recursively sorted object keys — used for hashing. */
function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v && typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, val]) => `${JSON.stringify(k)}:${stableStringify(val)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

/** FNV-1a 32-bit hash → hex. Small, dependency-free, stable across runs. */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * Stable fingerprint of a judge request. Identical inputs (same judge provider,
 * model, job description and candidate content — ignoring volatile ids) yield
 * the same key, so a verdict can be cached and re-judging returns the same
 * result instead of re-sampling the model.
 */
export function judgeCacheKey(
  judgeProvider: string,
  model: string,
  jobDescription: string,
  candidates: JudgeCandidate[],
): string {
  const payload = stableStringify({
    j: judgeProvider,
    m: model ?? "",
    jd: jobDescription.trim(),
    c: candidates.map((c) => ({ id: c.id, cv: canonicalCV(c.cv) })),
  });
  return fnv1a(payload);
}

/**
 * Content fingerprint of a CV (ids stripped). Used by Simulate/Target to detect
 * when the working document changed after a retone preview or baseline lock so
 * match/score always track the latest edit + applied refine.
 */
export function cvContentSig(cv: CVData): string {
  return fnv1a(stableStringify(canonicalCV(cv)));
}

function clamp(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Parse + validate judge output. Guarantees a valid winner among candidate ids. */
export function parseVerdict(raw: string, candidateIds: string[]): JudgeVerdict {
  const obj = parseModelJSON(raw);
  const rawScores = Array.isArray(obj.scores) ? obj.scores : [];
  const scores: JudgeScore[] = candidateIds.map((id) => {
    const found = (rawScores as Record<string, unknown>[]).find((s) => String(s?.id) === id) ?? {};
    return {
      id,
      relevance: clamp(found.relevance),
      impact: clamp(found.impact),
      coverage: clamp(found.coverage),
      conciseness: clamp(found.conciseness),
      overall: clamp(found.overall),
      rationale: typeof found.rationale === "string" ? found.rationale : "",
    };
  });
  // Ensure a valid winner: trust the model if valid, else highest overall.
  let winner = typeof obj.winner === "string" && candidateIds.includes(obj.winner) ? obj.winner : "";
  if (!winner) {
    winner = scores.reduce((best, s) => (s.overall > (best?.overall ?? -1) ? s : best), scores[0])?.id ?? candidateIds[0];
  }
  const reasoning = typeof obj.reasoning === "string" ? obj.reasoning : "";
  return { scores, winner, reasoning };
}
