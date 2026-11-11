/**
 * orire — runs the CV refinement agents and applies the deterministic fact guard
 * + ATS check. Two request-sized steps with one human pause between them:
 *   runAnalysis → (candidate answers the questions) → runRewrite
 * The model caller is injected so the pipeline is testable without a provider.
 */

import type { CVData } from "@/lib/cv/schema";
import {
  ANALYST_SYSTEM,
  CRITIC_SYSTEM,
  ELICITOR_SYSTEM,
  GAP_SYSTEM,
  REWRITER_SYSTEM,
  buildAnalystPrompt,
  buildCriticPrompt,
  buildElicitorPrompt,
  buildGapPrompt,
  buildRewriterPrompt,
  parseCritique,
  parseGapReport,
  parseIdealProfile,
  parseQuestions,
  type Critique,
  type ElicitationQuestion,
  type ElicitedAnswer,
  type GapReport,
  type IdealProfile,
} from "@/lib/ai/agents";
import { acceptTypedFigures } from "@/lib/tailor/facts";
import { factGround, parseModelJSON, scoreGrounding, type GroundingScore } from "@/lib/ai/guardrails";
import { applyRefinePatch } from "@/lib/ai/refinePatch";
import { jdMatch, type JDMatch } from "@/lib/ai/jdmatch";
import type { ProviderCall } from "@/lib/ai/server/providerCall";

export type AgentName = "analyst" | "gap" | "elicitor" | "rewriter" | "critic";

export type AgentCaller = (agent: AgentName, system: string, user: string) => Promise<ProviderCall>;

export interface AnalysisResult {
  ok: true;
  profile: IdealProfile;
  report: GapReport;
  questions: ElicitationQuestion[];
}

export interface RewriteResult {
  ok: true;
  /** Fact-grounded CV after the rewriter's patch. */
  cv: CVData;
  warnings: string[];
  grounding: GroundingScore;
  ats: { before: JDMatch; after: JDMatch };
}

export interface PipelineFailure {
  ok: false;
  agent: AgentName;
  status?: number;
  message: string;
}

async function step<T>(
  call: AgentCaller,
  agent: AgentName,
  system: string,
  user: string,
  parse: (raw: string) => T,
): Promise<{ ok: true; value: T } | PipelineFailure> {
  const out = await call(agent, system, user);
  if (!out.ok) return { ok: false, agent, status: out.status, message: out.body };
  try {
    return { ok: true, value: parse(out.content) };
  } catch {
    return { ok: false, agent, message: `The ${agent} agent returned an unreadable response.` };
  }
}

export async function runAnalysis(
  cv: CVData,
  jobDescription: string,
  call: AgentCaller,
  seeds: string[] = [],
): Promise<AnalysisResult | PipelineFailure> {
  const analyst = await step(call, "analyst", ANALYST_SYSTEM, buildAnalystPrompt(jobDescription), parseIdealProfile);
  if (!analyst.ok) return analyst;
  const profile = analyst.value;

  const gap = await step(call, "gap", GAP_SYSTEM, buildGapPrompt(cv, profile, seeds), (raw) => parseGapReport(raw, cv));
  if (!gap.ok) return gap;
  const report = gap.value;

  // Nothing closeable means nothing to ask — skip the elicitor call.
  if (report.understated.length + report.plausible.length + report.weakBullets.length === 0) {
    return { ok: true, profile, report, questions: [] };
  }
  const elicitor = await step(call, "elicitor", ELICITOR_SYSTEM, buildElicitorPrompt(cv, profile, report), parseQuestions);
  if (!elicitor.ok) return elicitor;
  return { ok: true, profile, report, questions: elicitor.value };
}

const DISCLAIMER_RE =
  /\b(?:not|never|un)[ -]?(?:verified|confirmed|documented|claimed|recorded)\b|\bno (?:formal|exact|specific)\b[^.;)]*\b(?:metrics?|figures?|numbers?|data|programme|program)\b|\bunavailable\b/i;

/** Caveats copied from the candidate's answers describe what's missing, not what they did. */
export function disclaimerWarnings(cv: CVData): string[] {
  const texts = [cv.basics.summary, ...cv.experience.flatMap((e) => e.highlights), ...cv.projects.flatMap((p) => p.highlights)];
  return texts
    .map((t) => (t ?? "").match(DISCLAIMER_RE) && (t ?? "").trim())
    .filter((t): t is string => !!t)
    .map((t) => `A caveat leaked into your CV: “…${t.slice(-90)}”. Remove it; say only what you did.`);
}

export async function runRewrite(
  cv: CVData,
  jobDescription: string,
  profile: IdealProfile,
  report: GapReport,
  answers: ElicitedAnswer[],
  call: AgentCaller,
  feedback?: { critique: Critique; previousDraft: CVData },
): Promise<RewriteResult | PipelineFailure> {
  const rewriter = await step(
    call,
    "rewriter",
    REWRITER_SYSTEM,
    buildRewriterPrompt(cv, jobDescription, profile, report, answers, feedback),
    parseModelJSON,
  );
  if (!rewriter.ok) return rewriter;

  const grounded = factGround(cv, applyRefinePatch(cv, rewriter.value));
  const warnings = [...acceptTypedFigures(grounded.warnings, answers), ...disclaimerWarnings(grounded.cv)];
  return {
    ok: true,
    cv: grounded.cv,
    warnings,
    grounding: scoreGrounding({ cv: grounded.cv, warnings }),
    ats: { before: jdMatch(cv, jobDescription), after: jdMatch(grounded.cv, jobDescription) },
  };
}

export interface CritiqueResult {
  ok: true;
  critique: Critique;
  /** Deterministic ATS coverage of the draft, shown alongside the critique. */
  ats: JDMatch;
}

export async function runCritique(
  draft: CVData,
  jobDescription: string,
  profile: IdealProfile,
  call: AgentCaller,
): Promise<CritiqueResult | PipelineFailure> {
  const ats = jdMatch(draft, jobDescription);
  const critic = await step(call, "critic", CRITIC_SYSTEM, buildCriticPrompt(draft, profile, ats.missing), (raw) =>
    parseCritique(raw, draft),
  );
  if (!critic.ok) return critic;
  return { ok: true, critique: critic.value, ats };
}
