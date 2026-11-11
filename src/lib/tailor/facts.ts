/**
 * orire — Tailor fact ledger (ADR 0002, phase 3).
 *
 * A fact is something the candidate told us in their own words, such as a
 * Coach answer, with the question it answered and the job it was given for.
 * Facts are reused across tools and runs so nothing is asked twice, and the
 * grounding guard treats figures the candidate typed as grounded.
 *
 * The ledger is a list of records merged by id. Deleting leaves a tombstone so
 * a delete on one device is not undone by another device's older copy.
 */

export const MAX_FACTS = 100;
export const MAX_FACT_TEXT = 600;

export interface Fact {
  id: string;
  /** What the question was about, e.g. "Measured impact". Matching key for reuse. */
  area: string;
  question: string;
  answer: string;
  /** Short label of the job it was given for. */
  job: string;
  createdAt: number;
  updatedAt: number;
  /** Tombstone: the candidate removed this fact. */
  deleted?: true;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Same area and question always map to the same id, so a re-answer updates in place. */
export function factId(area: string, question: string): string {
  const s = `${norm(area)}|${norm(question)}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `f_${h.toString(36)}`;
}

export const liveFacts = (facts: Fact[]): Fact[] =>
  facts.filter((f) => !f.deleted).sort((a, b) => b.updatedAt - a.updatedAt);

function cap(facts: Fact[]): Fact[] {
  const live = liveFacts(facts).slice(0, MAX_FACTS);
  const dead = facts.filter((f) => f.deleted).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_FACTS);
  return [...live, ...dead];
}

export interface AnswerInput {
  area: string;
  question: string;
  answer: string;
}

/** Add or update facts from answered questions. Blank answers are ignored. */
export function recordAnswers(facts: Fact[], inputs: AnswerInput[], job: string, now: number): Fact[] {
  const byId = new Map(facts.map((f) => [f.id, f]));
  for (const input of inputs) {
    const answer = input.answer.trim().slice(0, MAX_FACT_TEXT);
    if (!answer) continue;
    const id = factId(input.area, input.question);
    const prev = byId.get(id);
    if (prev && !prev.deleted && prev.answer === answer) continue;
    byId.set(id, {
      id,
      area: input.area.trim().slice(0, 120),
      question: input.question.trim().slice(0, 400),
      answer,
      job: job.trim().slice(0, 80),
      createdAt: prev && !prev.deleted ? prev.createdAt : now,
      updatedAt: now,
    });
  }
  return cap([...byId.values()]);
}

export function removeFact(facts: Fact[], id: string, now: number): Fact[] {
  return facts.map((f) => (f.id === id ? { ...f, answer: "", deleted: true as const, updatedAt: now } : f));
}

/** Merge two copies of the ledger; the newer record wins for each id. */
export function mergeFacts(a: Fact[], b: Fact[]): Fact[] {
  const byId = new Map<string, Fact>();
  for (const f of [...a, ...b]) {
    const prev = byId.get(f.id);
    if (!prev || f.updatedAt > prev.updatedAt) byId.set(f.id, f);
  }
  return cap([...byId.values()]);
}

/** Validate untrusted ledger data (storage or the server). Drops anything malformed. */
export function sanitizeFacts(raw: unknown): Fact[] {
  if (!Array.isArray(raw)) return [];
  const out: Fact[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    const id = s(o.id, 40);
    if (!id) continue;
    const deleted = o.deleted === true;
    const answer = deleted ? "" : s(o.answer, MAX_FACT_TEXT).trim();
    if (!deleted && !answer) continue;
    out.push({
      id,
      area: s(o.area, 120),
      question: s(o.question, 400),
      answer,
      job: s(o.job, 80),
      createdAt: n(o.createdAt),
      updatedAt: n(o.updatedAt),
      ...(deleted ? { deleted: true as const } : {}),
    });
  }
  return cap(out);
}

/** The most recent live fact that answers a question about the same area. */
export function factForArea(facts: Fact[], area: string): Fact | undefined {
  const key = norm(area);
  return key ? liveFacts(facts).find((f) => norm(f.area) === key) : undefined;
}

/** Facts as prompt lines for a model: only what the candidate said. */
export function factLines(facts: Fact[], limit: number): { question: string; answer: string }[] {
  return liveFacts(facts)
    .slice(0, limit)
    .map((f) => ({ question: f.question, answer: f.answer }));
}

const numKey = (tok: string) => tok.replace(/[$,%\s]/g, "").replace(/\.$/, "");
const numbersIn = (s: string) => (s.match(/\$?\d[\d.,]*%?[kKmMbB]?/g) ?? []).map(numKey);

/**
 * factGround warns about figures absent from the source CV. A figure the
 * candidate typed themselves is grounded, so drop those warnings; everything
 * else (invented numbers, entities, skills) still counts against the draft.
 */
export function acceptTypedFigures(warnings: string[], typed: { answer: string }[]): string[] {
  const allowed = new Set(typed.flatMap((a) => numbersIn(a.answer)));
  if (allowed.size === 0) return warnings;
  return warnings.filter((w) => {
    const m = w.match(/^Unverified figure “([^”]+)”/);
    return !(m && allowed.has(numKey(m[1])));
  });
}

/** Clean untrusted prompt facts from a request body: bounded count and length. */
export function sanitizePromptFacts(raw: unknown, limit = 12): { question: string; answer: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { question: string; answer: string }[] = [];
  for (const r of raw) {
    if (out.length >= limit) break;
    const o = (r ?? {}) as Record<string, unknown>;
    const answer = typeof o.answer === "string" ? o.answer.trim().slice(0, MAX_FACT_TEXT) : "";
    if (!answer) continue;
    const question = typeof o.question === "string" ? o.question.trim().slice(0, 400) : "";
    out.push({ question, answer });
  }
  return out;
}
