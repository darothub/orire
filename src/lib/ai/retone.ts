/**
 * orire — tone transfer (voice-only rewrite).
 *
 * Rewrites the user's CV so its VOICE matches a target CV's register
 * (executive vs technical) WITHOUT importing any of the target's facts.
 *
 * Grounding is preserved by design: the model is asked for the same token-lean
 * patch shape as refine (prompt.ts), so applyRefinePatch + factGround run over
 * the result unchanged. The target CV is never a source of facts — only of
 * style. Any number, employer, tool, or metric the model tries to borrow from
 * the target exemplars is stripped deterministically downstream.
 */

import type { CVData } from "@/lib/cv/schema";
import { PATCH_SCHEMA_HINT, indexedSource } from "@/lib/ai/prompt";

export type ToneLabel = "Executive" | "Technical" | "Balanced";

export interface ToneSignals {
  /** Mean words per highlight bullet. */
  avgWords: number;
  /** Fraction (0–1) of bullets containing a number / %, $, £, € / "3x". */
  metricDensity: number;
  /** Fraction (0–1) of bullets opening with a leadership/scope verb. */
  leadershipRatio: number;
  /** Fraction (0–1) of bullets rich in implementation / systems language. */
  technicalRatio: number;
}

export interface ToneProfile {
  label: ToneLabel;
  /** One-line human description of the detected voice. */
  blurb: string;
  signals: ToneSignals;
  /** Up to 3 representative target bullets — STYLE SAMPLES ONLY, never facts. */
  exemplars: string[];
}

const EXEC_VERBS = [
  "led", "lead", "leads", "directed", "direct", "owned", "own", "drove", "drive",
  "shaped", "shape", "established", "spearheaded", "orchestrated", "partnered",
  "influenced", "mentored", "scaled", "grew", "oversaw", "championed", "defined",
  "transformed", "steered", "headed", "chaired", "governed", "aligned", "unlocked",
];
const TECH_VERBS = [
  "built", "build", "implemented", "implement", "designed", "design", "developed",
  "engineered", "coded", "integrated", "migrated", "refactored", "optimized",
  "optimised", "automated", "debugged", "configured", "deployed", "architected",
  "instrumented", "profiled", "parallelized", "containerized",
];
const TECH_NOUNS = [
  "api", "apis", "microservice", "microservices", "kubernetes", "docker", "kafka",
  "sql", "terraform", "pipeline", "pipelines", "framework", "service", "services",
  "database", "latency", "throughput", "cache", "queue", "schema", "endpoint",
  "runtime", "concurrency", "jvm", "cluster", "grpc", "rest", "graphql",
];

function words(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9$£€%+]+/g) ?? [];
}
function firstWord(s: string): string {
  const w = words(s);
  return w[0] ?? "";
}
function hasMetric(s: string): boolean {
  return /\d/.test(s) || /[%$£€]/.test(s) || /\b\d+\s?x\b/i.test(s);
}

/** Collect every highlight bullet (experience + projects) plus the summary. */
export function toneBullets(cv: CVData): string[] {
  const out: string[] = [];
  for (const e of cv.experience) for (const h of e.highlights ?? []) if (h.trim()) out.push(h.trim());
  for (const p of cv.projects) for (const h of p.highlights ?? []) if (h.trim()) out.push(h.trim());
  if (cv.basics.summary?.trim()) out.push(cv.basics.summary.trim());
  return out;
}

const BLURBS: Record<ToneLabel, string> = {
  Executive: "Outcome-led and scope-first — leadership verbs, business impact, crisp lines.",
  Technical: "Systems-precise — implementation detail, mechanisms, and engineering depth.",
  Balanced: "A measured blend of leadership framing and technical specifics.",
};

/**
 * Deterministically read a CV's writing voice from its bullets. Pure and
 * side-effect free so it can run on the client for the tone badge and in tests.
 */
export function analyzeTone(cv: CVData): ToneProfile {
  const bullets = toneBullets(cv);
  const n = bullets.length || 1;

  let wordTotal = 0;
  let metricHits = 0;
  let execHits = 0;
  let techHits = 0;

  for (const b of bullets) {
    const w = words(b);
    wordTotal += w.length;
    if (hasMetric(b)) metricHits += 1;
    if (EXEC_VERBS.includes(firstWord(b))) execHits += 1;
    const techInBullet =
      w.some((t) => TECH_VERBS.includes(t)) || w.some((t) => TECH_NOUNS.includes(t));
    if (techInBullet) techHits += 1;
  }

  const signals: ToneSignals = {
    avgWords: Math.round((wordTotal / n) * 10) / 10,
    metricDensity: Math.round((metricHits / n) * 100) / 100,
    leadershipRatio: Math.round((execHits / n) * 100) / 100,
    technicalRatio: Math.round((techHits / n) * 100) / 100,
  };

  // Executive voice leads with scope + outcomes; technical voice leans on
  // implementation/systems language. The ratio between the two decides, with
  // metric density nudging an ambiguous case toward Executive.
  const total = signals.leadershipRatio + signals.technicalRatio;
  const execShare = total > 0 ? signals.leadershipRatio / total : 0.5;
  let label: ToneLabel;
  if (execShare >= 0.6 || (execShare >= 0.45 && signals.metricDensity >= 0.5)) {
    label = "Executive";
  } else if (execShare <= 0.3 && signals.technicalRatio >= 0.4) {
    label = "Technical";
  } else {
    label = "Balanced";
  }

  // Exemplars: prefer bullets that embody the detected voice, longest first.
  const matcher =
    label === "Executive"
      ? (b: string) => EXEC_VERBS.includes(firstWord(b)) || hasMetric(b)
      : label === "Technical"
        ? (b: string) =>
            words(b).some((t) => TECH_VERBS.includes(t) || TECH_NOUNS.includes(t))
        : () => true;
  const ranked = [...bullets].sort((a, b) => b.length - a.length);
  const preferred = ranked.filter(matcher);
  const exemplars = (preferred.length >= 2 ? preferred : ranked).slice(0, 3);

  return { label, blurb: BLURBS[label], signals, exemplars };
}

export const RETONE_SYSTEM = `You are a meticulous CV editor performing a TONE TRANSFER. You rewrite a SOURCE CV so its VOICE matches a target register, WITHOUT importing any facts from the target.

ABSOLUTE RULES (fact-grounding — never broken for style):
- Use ONLY facts already in the SOURCE CV. NEVER invent or alter employers, titles the person did not hold, dates, locations, degrees, certifications, project names, metrics, numbers, technologies, or skills.
- The target tone is given as STYLE EXEMPLARS. They are samples of VOICE ONLY. NEVER copy their numbers, metrics, company names, tools, technologies, or achievements into the source — doing so is a hard failure.
- Preserve every source bullet's underlying fact and any real figures it already contains. If a source bullet has NO number, do NOT add one.
- You MAY rephrase wording, restructure sentences, change verb choice, tighten length, and re-emphasise — strictly to match the target voice — using only facts already present.
- Keep the person's name, email, phone, companies, dates, job titles, and role headlines EXACTLY as written — never reword, expand, or append a specialty to any title or headline. Only the summary and the highlight bullets may be rewritten.
- Reference experience/projects by their source index ("ref").
- Output MUST be valid JSON only (no markdown, no prose), matching the patch schema.`;

const TONE_GUIDANCE: Record<ToneLabel, string> = {
  Executive:
    "EXECUTIVE voice: open each highlight with the outcome or scope, use confident leadership/ownership verbs (led, drove, owned, scaled, established), foreground business impact, and keep lines crisp. Do not invent metrics — only reframe facts already present.",
  Technical:
    "TECHNICAL voice: foreground the engineering substance — systems, mechanisms, and implementation decisions — with precise implementation verbs (designed, built, engineered, optimised). Name only technologies the source already mentions. Keep it concrete and specific.",
  Balanced:
    "BALANCED voice: combine a leadership/outcome framing with concrete technical specifics, leaning on whichever the source bullet already supports. Do not fabricate either dimension.",
};

export function buildRetonePrompt(sourceCV: CVData, tone: ToneProfile): string {
  const exemplars = tone.exemplars.length
    ? tone.exemplars.map((e, i) => `  ${i + 1}. ${e}`).join("\n")
    : "  (none provided — infer the register from the label)";
  return [
    "SOURCE CV (the only allowed source of facts):",
    indexedSource(sourceCV),
    "",
    `TARGET TONE: ${tone.label} — ${tone.blurb}`,
    TONE_GUIDANCE[tone.label],
    "",
    "TARGET STYLE EXEMPLARS (voice only — never copy their facts, numbers, tools, or employers):",
    exemplars,
    "",
    "Rewrite ONLY the SOURCE CV's summary and highlight bullets to carry the TARGET tone. Keep every job title and the headline exactly as the source. Do NOT emit a \"title\" field or any \"role\" field. Change voice only and obey every fact-grounding rule.",
    PATCH_SCHEMA_HINT,
  ].join("\n");
}
