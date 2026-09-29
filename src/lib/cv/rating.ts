/**
 * orire — deterministic CV rating (req 16 + req 21).
 *
 * Rates a CV against a fixed rubric with NO model call: the same CV always
 * yields the same score. Used to measure how a final (AI-refined or edited)
 * CV improves on the initial one the user started from.
 *
 * Every metric is a pure function of the CVData facts already in the store —
 * consistent with the fact-grounding principle: we evaluate structure and
 * phrasing, never invent content.
 */

import type { CVData } from "@/lib/cv/schema";

export interface Metric {
  key: string;
  label: string;
  /** 0–100. */
  value: number;
  /** Short human explanation of what was measured. */
  hint: string;
  /** Relative weight in the overall score. */
  weight: number;
}

export interface CVScore {
  /** 0–100 weighted overall. */
  overall: number;
  metrics: Metric[];
}

export interface MetricDelta {
  key: string;
  label: string;
  before: number;
  after: number;
  diff: number;
}

export interface ScoreDiff {
  before: number;
  after: number;
  diff: number;
  metrics: MetricDelta[];
}

/** Strong résumé action verbs (lowercase, stem-ish). */
const ACTION_VERBS = new Set([
  "led", "built", "designed", "developed", "created", "launched", "delivered",
  "improved", "increased", "reduced", "drove", "managed", "owned", "shipped",
  "architected", "implemented", "optimized", "streamlined", "automated",
  "spearheaded", "established", "scaled", "mentored", "negotiated", "achieved",
  "generated", "grew", "cut", "accelerated", "transformed", "engineered",
  "coordinated", "executed", "initiated", "founded", "redesigned", "migrated",
  "integrated", "resolved", "boosted", "saved", "won", "produced", "analyzed",
  "researched", "directed", "oversaw", "championed", "pioneered", "expanded",
  "modernized", "refactored", "deployed", "orchestrated", "consolidated",
]);

function words(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

/** All achievement bullets across experience + projects. */
function bullets(cv: CVData): string[] {
  const out: string[] = [];
  for (const e of cv.experience) for (const h of e.highlights) if (h.trim()) out.push(h);
  for (const p of cv.projects) for (const h of p.highlights) if (h.trim()) out.push(h);
  return out;
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Completeness — are the expected sections present and filled? */
function scoreCompleteness(cv: CVData): number {
  const b = cv.basics;
  const checks = [
    b.summary.trim().length > 0,
    cv.experience.some((e) => e.company.trim() || e.role.trim()),
    cv.education.some((e) => e.institution.trim() || e.degree.trim()),
    cv.skills.some((g) => g.items.some((i) => i.trim())),
    cv.projects.some((p) => p.name.trim()),
    cv.certifications.some((c) => c.name.trim()),
    b.email.trim().length > 0 && b.location.trim().length > 0,
  ];
  return pct(checks.filter(Boolean).length, checks.length);
}

/** Impact — share of bullets carrying a quantified result (number, %, $, x). */
function scoreImpact(cv: CVData): number {
  const bs = bullets(cv);
  if (bs.length === 0) return 0;
  const hasMetric = bs.filter((h) => /\d/.test(h) || /[%$]|(^|\s)\d+x(\s|$)/i.test(h)).length;
  // Reward a healthy share; 55%+ quantified bullets counts as excellent.
  return clamp((hasMetric / bs.length) * 100 * (100 / 55));
}

/** Action verbs — share of bullets opening with a strong verb. */
function scoreActionVerbs(cv: CVData): number {
  const bs = bullets(cv);
  if (bs.length === 0) return 0;
  const strong = bs.filter((h) => {
    const first = words(h)[0]?.toLowerCase().replace(/[^a-z]/g, "");
    return first ? ACTION_VERBS.has(first) : false;
  }).length;
  // 75%+ strong openers is excellent.
  return clamp((strong / bs.length) * 100 * (100 / 75));
}

/** Conciseness — bullets and summary sitting in a readable length band. */
function scoreConciseness(cv: CVData): number {
  const bs = bullets(cv);
  let bulletScore = 100;
  if (bs.length) {
    const inBand = bs.filter((h) => {
      const w = words(h).length;
      return w >= 6 && w <= 30;
    }).length;
    bulletScore = pct(inBand, bs.length);
  }
  const sw = words(cv.basics.summary).length;
  const summaryScore = cv.basics.summary.trim()
    ? sw >= 20 && sw <= 70
      ? 100
      : sw >= 12 && sw <= 90
        ? 70
        : 40
    : 0;
  return clamp(bulletScore * 0.7 + summaryScore * 0.3);
}

/** Skills depth — enough distinct, categorised skills. */
function scoreSkills(cv: CVData): number {
  const all = cv.skills.flatMap((g) => g.items.map((i) => i.trim().toLowerCase())).filter(Boolean);
  const distinct = new Set(all).size;
  // 12 distinct skills → full marks.
  const depth = clamp((distinct / 12) * 100);
  // Small bonus for categorisation (>=2 groups).
  const grouped = cv.skills.filter((g) => g.items.some((i) => i.trim())).length >= 2 ? 100 : 60;
  return clamp(depth * 0.8 + grouped * 0.2);
}

/** Clarity — title, contactable links, and a present, well-sized summary. */
function scoreClarity(cv: CVData): number {
  const b = cv.basics;
  const checks = [
    b.title.trim().length > 0,
    b.summary.trim().length > 0,
    b.links.some((l) => l.url.trim()),
    b.phone.trim().length > 0 || b.email.trim().length > 0,
  ];
  return pct(checks.filter(Boolean).length, checks.length);
}

/** Score a CV across the rubric. Deterministic. */
export function scoreCV(cv: CVData): CVScore {
  const metrics: Metric[] = [
    { key: "completeness", label: "Completeness", weight: 20, value: scoreCompleteness(cv), hint: "Expected sections present and filled" },
    { key: "impact", label: "Impact", weight: 22, value: scoreImpact(cv), hint: "Bullets with quantified results (numbers, %, $)" },
    { key: "actionVerbs", label: "Action verbs", weight: 18, value: scoreActionVerbs(cv), hint: "Bullets opening with a strong verb" },
    { key: "conciseness", label: "Conciseness", weight: 15, value: scoreConciseness(cv), hint: "Bullets and summary in a readable length" },
    { key: "skills", label: "Skills depth", weight: 10, value: scoreSkills(cv), hint: "Distinct, categorised skills" },
    { key: "clarity", label: "Clarity", weight: 15, value: scoreClarity(cv), hint: "Title, links and a sharp summary" },
  ];
  const totalWeight = metrics.reduce((a, m) => a + m.weight, 0);
  const overall = clamp(metrics.reduce((a, m) => a + m.value * m.weight, 0) / totalWeight);
  return { overall, metrics };
}

/** Compare a baseline (initial) CV to a final CV. */
export function diffScores(before: CVData, after: CVData): ScoreDiff {
  const b = scoreCV(before);
  const a = scoreCV(after);
  const metrics: MetricDelta[] = a.metrics.map((am) => {
    const bm = b.metrics.find((x) => x.key === am.key)!;
    return { key: am.key, label: am.label, before: bm.value, after: am.value, diff: am.value - bm.value };
  });
  return { before: b.overall, after: a.overall, diff: a.overall - b.overall, metrics };
}

/** A short verdict label for an overall score. */
export function grade(overall: number): string {
  if (overall >= 90) return "Outstanding";
  if (overall >= 78) return "Strong";
  if (overall >= 62) return "Solid";
  if (overall >= 45) return "Developing";
  return "Needs work";
}
