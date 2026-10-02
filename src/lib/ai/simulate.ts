/**
 * orire — job-description simulation (req 20).
 *
 * Generates a SYNTHETIC "ideal candidate" CV that would be a ~100% match for a
 * job description. This is explicitly a benchmark / target profile — it is NOT
 * the user's facts and must never be written into their real CV (that would
 * violate fact-grounding). Its purpose is a gap analysis: show the user, in
 * concrete terms, what a perfect match looks like and where they differ.
 *
 * The gap analysis itself is fully deterministic.
 */

import {
  type CVData,
  type SectionKey,
  ALL_SECTIONS,
  uid,
} from "@/lib/cv/schema";
import { parseModelJSON } from "@/lib/ai/guardrails";

const SCHEMA_HINT = `Return ONLY a JSON object with exactly this shape (no markdown, no prose):
{
  "basics": {
    "fullName": "Ideal Candidate", "title": string, "email": "candidate@example.com",
    "phone": "", "location": string, "summary": string,
    "links": [{ "label": string, "url": string }]
  },
  "experience": [{
    "company": string, "role": string, "location": string,
    "startDate": string, "endDate": string, "current": boolean,
    "highlights": [string]
  }],
  "education": [{
    "institution": string, "degree": string, "field": string,
    "startDate": string, "endDate": string, "details": string
  }],
  "skills": [{ "category": string, "items": [string] }],
  "projects": [{
    "name": string, "role": string, "url": string,
    "startDate": string, "endDate": string, "highlights": [string]
  }],
  "certifications": [{ "name": string, "issuer": string, "date": string, "url": string }]
}`;

export const SIMULATE_SYSTEM = `You are a senior technical recruiter. Given a job description, you construct the profile of a HYPOTHETICAL ideal candidate whose CV would score a ~100% match for that role.

RULES:
- This is a SIMULATION, not a real person. Use the placeholder name "Ideal Candidate" and a placeholder email; leave phone empty.
- Populate every relevant section with realistic, specific content that a top-tier match would have: a sharp tailored summary, 2–4 progressive roles with quantified, achievement-focused bullets, fitting education, a well-organised skill set covering the technologies and competencies the job asks for, 1–3 relevant projects, and any certifications the role typically expects.
- Make bullets concrete and metric-driven (numbers, %, scale) — the way an outstanding CV reads.
- Cover the explicit AND implicit requirements of the job description.
- Output must be valid JSON only, matching the given schema. No commentary.`;

export function buildSimulatePrompt(jobDescription: string): string {
  return [
    "TARGET JOB DESCRIPTION:",
    "```",
    jobDescription.trim(),
    "```",
    "",
    "Construct the ideal-match candidate CV for this job.",
    SCHEMA_HINT,
  ].join("\n");
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function asStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(asStr).map((s) => s.trim()).filter(Boolean);
}
function asBool(v: unknown): boolean {
  return v === true || v === "true";
}

/** Coerce raw model JSON into a valid CVData. No grounding — this is synthetic. */
export function coerceSimulatedCV(raw: string): CVData {
  const obj = parseModelJSON(raw);
  const b = (obj.basics ?? {}) as Record<string, unknown>;
  const links = Array.isArray(b.links)
    ? (b.links as Record<string, unknown>[]).map((l) => ({
        id: uid("lnk"),
        label: asStr(l?.label).trim(),
        url: asStr(l?.url).trim(),
      })).filter((l) => l.label || l.url)
    : [];

  const experience = (Array.isArray(obj.experience) ? obj.experience : []).map((e) => {
    const x = e as Record<string, unknown>;
    return {
      id: uid("exp"),
      company: asStr(x.company).trim(),
      role: asStr(x.role).trim(),
      location: asStr(x.location).trim(),
      startDate: asStr(x.startDate).trim(),
      endDate: asStr(x.endDate).trim(),
      current: asBool(x.current),
      highlights: asStrArray(x.highlights),
    };
  });

  const education = (Array.isArray(obj.education) ? obj.education : []).map((e) => {
    const x = e as Record<string, unknown>;
    return {
      id: uid("edu"),
      institution: asStr(x.institution).trim(),
      degree: asStr(x.degree).trim(),
      field: asStr(x.field).trim(),
      startDate: asStr(x.startDate).trim(),
      endDate: asStr(x.endDate).trim(),
      details: asStr(x.details).trim(),
    };
  });

  const skills = (Array.isArray(obj.skills) ? obj.skills : []).map((g) => {
    const x = g as Record<string, unknown>;
    return { id: uid("skl"), category: asStr(x.category).trim(), items: asStrArray(x.items) };
  }).filter((g) => g.items.length);

  const projects = (Array.isArray(obj.projects) ? obj.projects : []).map((p) => {
    const x = p as Record<string, unknown>;
    return {
      id: uid("prj"),
      name: asStr(x.name).trim(),
      role: asStr(x.role).trim(),
      url: asStr(x.url).trim(),
      startDate: asStr(x.startDate).trim(),
      endDate: asStr(x.endDate).trim(),
      highlights: asStrArray(x.highlights),
    };
  }).filter((p) => p.name);

  const certifications = (Array.isArray(obj.certifications) ? obj.certifications : []).map((c) => {
    const x = c as Record<string, unknown>;
    return {
      id: uid("crt"),
      name: asStr(x.name).trim(),
      issuer: asStr(x.issuer).trim(),
      date: asStr(x.date).trim(),
      url: asStr(x.url).trim(),
    };
  }).filter((c) => c.name);

  const basics = {
    fullName: asStr(b.fullName).trim() || "Ideal Candidate",
    title: asStr(b.title).trim(),
    email: asStr(b.email).trim() || "candidate@example.com",
    phone: asStr(b.phone).trim(),
    location: asStr(b.location).trim(),
    summary: asStr(b.summary).trim(),
    links,
  };

  // Order: canonical, keeping only sections that actually have content.
  const has: Record<SectionKey, boolean> = {
    summary: basics.summary.length > 0,
    experience: experience.length > 0,
    education: education.length > 0,
    skills: skills.length > 0,
    projects: projects.length > 0,
    certifications: certifications.length > 0,
  };
  const order = ALL_SECTIONS.filter((k) => has[k]);

  return { basics, experience, education, skills, projects, certifications, order };
}

export interface GapAnalysis {
  /** 0–100: share of the ideal's skills the user already has. */
  coverage: number;
  matchedSkills: string[];
  missingSkills: string[];
  /** Sections the ideal profile has that the user's CV is missing/empty. */
  missingSections: string[];
}

function skillSet(cv: CVData): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of cv.skills) for (const it of g.items) {
    const t = it.trim();
    if (t) m.set(t.toLowerCase(), t);
  }
  return m;
}

/** Deterministically compare the user's CV to the simulated ideal. */
export function gapAnalysis(userCV: CVData, ideal: CVData): GapAnalysis {
  const idealSkills = skillSet(ideal);
  const userSkills = skillSet(userCV);
  const matched: string[] = [];
  const missing: string[] = [];
  for (const [key, label] of idealSkills) {
    if (userSkills.has(key)) matched.push(label);
    else missing.push(label);
  }
  const total = idealSkills.size;
  const coverage = total === 0 ? 0 : Math.round((matched.length / total) * 100);

  const userHas: Record<SectionKey, boolean> = {
    summary: userCV.basics.summary.trim().length > 0,
    experience: userCV.experience.some((e) => e.company.trim() || e.role.trim()),
    education: userCV.education.some((e) => e.institution.trim() || e.degree.trim()),
    skills: userCV.skills.some((g) => g.items.some((i) => i.trim())),
    projects: userCV.projects.some((p) => p.name.trim()),
    certifications: userCV.certifications.some((c) => c.name.trim()),
  };
  const missingSections = ideal.order.filter((k) => !userHas[k]);

  return { coverage, matchedSkills: matched, missingSkills: missing, missingSections };
}

/* ── Enriched, deterministic target match (slice B) ──────────────────────
 * A single 0–100 "match" number that moves as the user edits — not only when
 * they add a skill. Four weighted, deterministic signals; no model call.      */

export interface TargetMatchMetric {
  key: "skills" | "keywords" | "sections" | "metrics";
  label: string;
  score: number;
  hint: string;
}

export interface TargetMatch {
  /** 0–100 overall, weighted over the applicable metrics. */
  score: number;
  metrics: TargetMatchMetric[];
  /** Underlying skill/section gap, reused for chips. */
  gap: GapAnalysis;
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "you", "your", "our", "are", "will", "have", "has",
  "this", "that", "from", "they", "them", "their", "a", "an", "to", "of", "in", "on",
  "as", "at", "by", "or", "be", "is", "we", "it", "its", "but", "not", "can", "all",
  "who", "job", "role", "work", "team", "teams", "year", "years", "experience", "ability",
  "strong", "about", "across", "within", "including", "etc", "per", "using", "use",
  "plus", "new", "well", "help", "like", "must", "should", "would", "into", "more",
  "most", "other", "such", "than", "then", "these", "those", "what", "when", "which",
  "while", "both", "each", "any", "may", "also", "out", "up", "if", "so", "do",
]);

function tokens(s: string): string[] {
  return s.toLowerCase().match(/[a-z][a-z0-9+#.]{1,}/g) ?? [];
}

/** Salient keywords from a job description, most-frequent first (deterministic). */
export function jdKeywords(jd: string, limit = 40): string[] {
  const freq = new Map<string, number>();
  for (const t of tokens(jd)) {
    if (t.length < 3 || STOPWORDS.has(t)) continue;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([w]) => w);
}

/** All user CV free text, lowercased, as a token set for word-level matching. */
function cvTokenSet(cv: CVData): Set<string> {
  const parts: Array<string | undefined> = [
    cv.basics.title,
    cv.basics.summary,
    ...cv.skills.flatMap((g) => [g.category, ...g.items]),
    ...cv.experience.flatMap((e) => [e.role, e.company, ...e.highlights]),
    ...cv.projects.flatMap((p) => [p.name, p.role, ...p.highlights]),
    ...cv.education.flatMap((e) => [e.degree, e.field, e.institution, e.details]),
    ...cv.certifications.flatMap((c) => [c.name, c.issuer]),
  ];
  return new Set(tokens(parts.join(" ")));
}

/** Share of experience/project bullets that carry a concrete number/metric. */
function metricDensity(cv: CVData): number {
  const bullets = [
    ...cv.experience.flatMap((e) => e.highlights),
    ...cv.projects.flatMap((p) => p.highlights),
  ].filter((b) => b.trim());
  if (bullets.length === 0) return 0;
  const withNum = bullets.filter((b) => /\d/.test(b)).length;
  return Math.round((withNum / bullets.length) * 100);
}

const MATCH_WEIGHTS: Record<TargetMatchMetric["key"], number> = {
  skills: 0.4,
  keywords: 0.25,
  sections: 0.15,
  metrics: 0.2,
};

/** Deterministic, edit-sensitive match of the user's CV to a locked ideal. */
export function targetMatch(userCV: CVData, ideal: CVData, jd = ""): TargetMatch {
  const gap = gapAnalysis(userCV, ideal);

  const kws = jdKeywords(jd);
  const cvTokens = cvTokenSet(userCV);
  const kwScore = kws.length === 0
    ? null
    : Math.round((kws.filter((k) => cvTokens.has(k)).length / kws.length) * 100);

  const sectionTotal = ideal.order.length;
  const sectionScore = sectionTotal === 0
    ? 100
    : Math.round(((sectionTotal - gap.missingSections.length) / sectionTotal) * 100);

  const metrics: TargetMatchMetric[] = [
    { key: "skills", label: "Skills coverage", score: gap.coverage, hint: "Skills the ideal lists that you also have." },
  ];
  if (kwScore !== null) {
    metrics.push({ key: "keywords", label: "JD keywords", score: kwScore, hint: "Key terms from the job description present in your CV." });
  }
  metrics.push(
    { key: "sections", label: "Sections", score: sectionScore, hint: "Sections the ideal profile has that you also fill." },
    { key: "metrics", label: "Quantified impact", score: metricDensity(userCV), hint: "Share of your bullets backed by a concrete number." },
  );

  let wSum = 0;
  let acc = 0;
  for (const m of metrics) {
    const w = MATCH_WEIGHTS[m.key];
    acc += m.score * w;
    wSum += w;
  }
  const score = wSum === 0 ? 0 : Math.round(acc / wSum);

  return { score, metrics, gap };
}
