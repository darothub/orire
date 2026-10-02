/**
 * orire — deterministic fact-grounding guardrails.
 *
 * The model's output is NEVER trusted as-is. After it returns, we:
 *  1. Parse the JSON (tolerating code fences).
 *  2. Coerce it into a valid CVData with fresh ids and the original section order.
 *  3. LOCK identity facts (name/email/phone/location/links) to the source — the
 *     model is not allowed to change who you are or how to reach you.
 *  4. Detect any content that is NOT grounded in the source CV (invented
 *     employers, institutions, dates, skills, etc.) and surface it as warnings
 *     so the user can review before applying.
 */

import {
  type CVData,
  type ExperienceItem,
  type EducationItem,
  type SkillGroup,
  type ProjectItem,
  type CertificationItem,
  uid,
} from "@/lib/cv/schema";

export interface GroundingResult {
  cv: CVData;
  /** Non-fatal, human-readable notes about content not found in the source. */
  warnings: string[];
}

/** Category of a guardrail warning — drives the deterministic fidelity score. */
export type WarningKind = "entity" | "number" | "skill";

export interface GroundingScore {
  /** 0–100 fidelity: how faithfully the output stayed grounded in the source. */
  score: number;
  label: "clean" | "minor" | "review";
  counts: { total: number; entity: number; number: number; skill: number };
}

/** Stable prefix so an invented-figure warning can be categorised deterministically. */
const FIGURE_PREFIX = "Unverified figure";

export class RefineParseError extends Error {}

function norm(v: unknown): string {
  return String(v ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function asStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(asStr).map((s) => s.trim()).filter(Boolean);
}

/** Strip ```json fences and locate the outermost JSON object. */
export function parseModelJSON(raw: string): Record<string, unknown> {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new RefineParseError("Model did not return a JSON object.");
  }
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice) as Record<string, unknown>;
  } catch (e) {
    throw new RefineParseError(
      `Could not parse model JSON: ${(e as Error).message}`
    );
  }
}

/** Collect the set of every date string that appears anywhere in the source. */
function sourceDateSet(src: CVData): Set<string> {
  const s = new Set<string>();
  const add = (d?: string) => {
    const n = norm(d);
    if (n) s.add(n);
  };
  src.experience.forEach((e) => (add(e.startDate), add(e.endDate)));
  src.education.forEach((e) => (add(e.startDate), add(e.endDate)));
  src.projects.forEach((p) => (add(p.startDate), add(p.endDate)));
  src.certifications.forEach((c) => add(c.date));
  return s;
}

/** Common skill aliases so a rephrase (e.g. "JS" -> "JavaScript") stays grounded. */
const SKILL_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  golang: "go",
  k8s: "kubernetes",
  postgres: "postgresql",
  "node": "nodejs",
  "node.js": "nodejs",
  "react.js": "react",
  "next.js": "nextjs",
  "vue.js": "vue",
  ml: "machine learning",
  ai: "artificial intelligence",
  nlp: "natural language processing",
  "ci/cd": "cicd",
  gcp: "google cloud",
  aws: "amazon web services",
};

function canonSkill(v: string): string {
  const n = norm(v).replace(/[.\-_/]/g, "");
  return SKILL_ALIASES[norm(v)] ?? SKILL_ALIASES[n] ?? n;
}

function tokens(v: string): string[] {
  return norm(v).split(/[^a-z0-9+#]+/).filter((t) => t.length > 1);
}

/**
 * Build a fuzzy skill matcher. A candidate skill is considered grounded when it
 * matches a source skill by: exact/canonical equality, alias expansion,
 * substring in either direction, or full token containment. This lets the model
 * rephrase ("JS" -> "JavaScript", "React.js" -> "React") without the rephrasing
 * being stripped as "not in source", while still rejecting genuinely invented
 * skills.
 */
function buildSkillMatcher(source: CVData): (candidate: string) => boolean {
  const items = source.skills.flatMap((g) => g.items).map((s) => s.trim()).filter(Boolean);
  const canon = new Set(items.map(canonSkill));
  const tokenSet = new Set(items.flatMap(tokens));
  const canonList = [...canon];

  return (candidate: string): boolean => {
    const c = canonSkill(candidate);
    if (!c) return false;
    if (canon.has(c)) return true;
    for (const s of canonList) {
      if (s.length >= 3 && c.length >= 3 && (s.includes(c) || c.includes(s))) return true;
    }
    const cTokens = tokens(candidate);
    if (cTokens.length > 0 && cTokens.every((t) => tokenSet.has(t))) return true;
    return false;
  };
}

export function factGround(source: CVData, candidate: Record<string, unknown>): GroundingResult {
  const warnings: string[] = [];

  // Source fact sets (normalised).
  const companies = new Set(source.experience.map((e) => norm(e.company)));
  const institutions = new Set(source.education.map((e) => norm(e.institution)));
  const degrees = new Set(source.education.map((e) => norm(e.degree)));
  const projectNames = new Set(source.projects.map((p) => norm(p.name)));
  const certNames = new Set(source.certifications.map((c) => norm(c.name)));
  const skillMatcher = buildSkillMatcher(source);
  const dates = sourceDateSet(source);

  const cBasics = (candidate.basics ?? {}) as Record<string, unknown>;

  // (3) Identity facts are LOCKED to the source — non-negotiable.
  const basics: CVData["basics"] = {
    fullName: source.basics.fullName,
    email: source.basics.email,
    phone: source.basics.phone,
    location: source.basics.location,
    links: source.basics.links,
    // Tailorable, but still grounded: title + summary may be rephrased.
    title: asStr(cBasics.title).trim() || source.basics.title,
    summary: asStr(cBasics.summary).trim() || source.basics.summary,
  };

  // Experience — company + dates must be grounded.
  const cExp = Array.isArray(candidate.experience) ? candidate.experience : [];
  const experience: ExperienceItem[] = cExp.map((raw) => {
    const e = (raw ?? {}) as Record<string, unknown>;
    const company = asStr(e.company).trim();
    if (company && !companies.has(norm(company))) {
      warnings.push(`Employer “${company}” is not in your source CV.`);
    }
    for (const d of [asStr(e.startDate), asStr(e.endDate)]) {
      if (d.trim() && !dates.has(norm(d))) {
        warnings.push(`Date “${d}” (at ${company || "an entry"}) is not in your source CV.`);
      }
    }
    return {
      id: uid("exp"),
      company,
      role: asStr(e.role).trim(),
      location: asStr(e.location).trim(),
      startDate: asStr(e.startDate).trim(),
      endDate: asStr(e.endDate).trim(),
      current: Boolean(e.current),
      highlights: asStrArray(e.highlights),
    };
  });

  // Education — institution + degree grounded.
  const cEdu = Array.isArray(candidate.education) ? candidate.education : [];
  const education: EducationItem[] = cEdu.map((raw) => {
    const e = (raw ?? {}) as Record<string, unknown>;
    const institution = asStr(e.institution).trim();
    const degree = asStr(e.degree).trim();
    if (institution && !institutions.has(norm(institution))) {
      warnings.push(`Institution “${institution}” is not in your source CV.`);
    }
    if (degree && !degrees.has(norm(degree))) {
      warnings.push(`Degree “${degree}” is not in your source CV.`);
    }
    return {
      id: uid("edu"),
      institution,
      degree,
      field: asStr(e.field).trim(),
      startDate: asStr(e.startDate).trim(),
      endDate: asStr(e.endDate).trim(),
      details: asStr(e.details).trim(),
    };
  });

  // Skills — every item must exist in the source (no invented skills).
  const cSkills = Array.isArray(candidate.skills) ? candidate.skills : [];
  const skills: SkillGroup[] = cSkills.map((raw) => {
    const g = (raw ?? {}) as Record<string, unknown>;
    const items = asStrArray(g.items);
    const kept = items.filter((it) => {
      if (skillMatcher(it)) return true;
      warnings.push(`Skill “${it}” is not in your source CV and was removed.`);
      return false;
    });
    return { id: uid("skl"), category: asStr(g.category).trim(), items: kept };
  });

  // Projects — name grounded.
  const cProjects = Array.isArray(candidate.projects) ? candidate.projects : [];
  const projects: ProjectItem[] = cProjects.map((raw) => {
    const p = (raw ?? {}) as Record<string, unknown>;
    const name = asStr(p.name).trim();
    if (name && !projectNames.has(norm(name))) {
      warnings.push(`Project “${name}” is not in your source CV.`);
    }
    return {
      id: uid("prj"),
      name,
      role: asStr(p.role).trim(),
      url: asStr(p.url).trim(),
      startDate: asStr(p.startDate).trim(),
      endDate: asStr(p.endDate).trim(),
      highlights: asStrArray(p.highlights),
    };
  });

  // Certifications — name grounded.
  const cCerts = Array.isArray(candidate.certifications) ? candidate.certifications : [];
  const certifications: CertificationItem[] = cCerts.map((raw) => {
    const c = (raw ?? {}) as Record<string, unknown>;
    const name = asStr(c.name).trim();
    if (name && !certNames.has(norm(name))) {
      warnings.push(`Certification “${name}” is not in your source CV.`);
    }
    return {
      id: uid("crt"),
      name,
      issuer: asStr(c.issuer).trim(),
      date: asStr(c.date).trim(),
      url: asStr(c.url).trim(),
    };
  });

  const cv: CVData = {
    basics,
    experience,
    education,
    skills,
    projects,
    certifications,
    // Preserve the user's current section order/visibility.
    order: source.order,
  };

  // (D) Invented-figure guard: metrics/percentages/currency in the tailored
  // bullets or summary that appear nowhere in the source are flagged. The model
  // may rephrase, but it must not fabricate quantified claims.
  warnings.push(...findInventedNumbers(source, cv));

  return { cv, warnings };
}

/** Normalise a numeric token for comparison: drop $, %, commas, spaces, trailing dot. */
function numKey(tok: string): string {
  return tok.replace(/[$,%\s]/g, "").replace(/\.$/, "");
}

/** Every numeric token (digits, decimals, %, currency) found in a blob of text. */
function extractNumbers(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\$?\d[\d.,]*%?[kKmMbB]?/g)) out.push(m[0]);
  return out;
}

/** All numeric tokens present anywhere in the source CV (the grounding truth). */
function collectSourceNumbers(src: CVData): Set<string> {
  const set = new Set<string>();
  const add = (t: unknown) => {
    for (const tok of extractNumbers(asStr(t))) set.add(numKey(tok));
  };
  const b = src.basics;
  [b.summary, b.title, b.location].forEach(add);
  for (const e of src.experience) {
    [e.company, e.role, e.location, e.startDate, e.endDate].forEach(add);
    (e.highlights ?? []).forEach(add);
  }
  for (const ed of src.education) [ed.institution, ed.degree, ed.field, ed.startDate, ed.endDate, ed.details].forEach(add);
  for (const s of src.skills) (s.items ?? []).forEach(add);
  for (const p of src.projects) {
    [p.name, p.role, p.startDate, p.endDate].forEach(add);
    (p.highlights ?? []).forEach(add);
  }
  for (const c of src.certifications) [c.name, c.issuer, c.date].forEach(add);
  return set;
}

/**
 * Deterministic guard for fabricated metrics. Scans the produced CV's bullets
 * and summary for numeric claims that do not appear anywhere in the source,
 * returning one warning per distinct (context, figure) pair.
 */
export function findInventedNumbers(source: CVData, cv: CVData): string[] {
  const src = collectSourceNumbers(source);
  const warnings: string[] = [];
  const seen = new Set<string>();
  const check = (text: string, where: string) => {
    for (const tok of extractNumbers(text)) {
      const key = numKey(tok);
      if (!key || src.has(key)) continue;
      const dedupe = `${where}|${key}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      warnings.push(`${FIGURE_PREFIX} “${tok}” in ${where} does not appear in your source CV — verify before sending.`);
    }
  };
  if (cv.basics.summary) check(cv.basics.summary, "your summary");
  for (const e of cv.experience) for (const h of e.highlights ?? []) check(h, `a ${e.company || "experience"} highlight`);
  for (const p of cv.projects) for (const h of p.highlights ?? []) check(h, `a ${p.name || "project"} highlight`);
  return warnings;
}

/** Classify a guardrail warning so penalties can be weighted deterministically. */
function classifyWarning(w: string): WarningKind {
  if (w.startsWith(FIGURE_PREFIX)) return "number";
  if (w.includes("was removed")) return "skill";
  return "entity";
}

/**
 * Deterministic fidelity score (0–100) from guardrail warnings. Invented
 * entities (employers, schools, projects…) weigh most, fabricated figures
 * next, stripped skills least. Pure and fully reproducible.
 */
export function scoreGrounding(result: GroundingResult): GroundingScore {
  const counts = { total: 0, entity: 0, number: 0, skill: 0 };
  let penalty = 0;
  for (const w of result.warnings) {
    const kind = classifyWarning(w);
    counts[kind] += 1;
    counts.total += 1;
    penalty += kind === "entity" ? 8 : kind === "number" ? 6 : 3;
  }
  const score = Math.max(0, 100 - penalty);
  const label = score >= 90 ? "clean" : score >= 70 ? "minor" : "review";
  return { score, label, counts };
}
