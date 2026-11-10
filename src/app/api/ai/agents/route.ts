/**
 * orire — CV refinement agents route (Node runtime).
 *
 * Runs the analyze (analyst → gap finder → elicitor) and rewrite steps on orire's managed keys and
 * returns the ideal-candidate profile, a bucketed gap report and targeted questions
 * (analyze), then a fact-grounded CV using the candidate's answers plus ATS
 * keyword coverage before/after (rewrite). Auth, rate limit and size caps mirror the
 * other AI routes.
 */

import { NextResponse } from "next/server";
import type { CVData } from "@/lib/cv/schema";
import { DETERMINISTIC, type ProviderCall } from "@/lib/ai/server/providerCall";
import { runRoutedWithFailover } from "@/lib/ai/server/failover";
import { serverKeyFor, notConfiguredMessage } from "@/lib/ai/server/serverKey";
import { fakeAiFor, fakeRefinePatch } from "@/lib/ai/server/fakeProvider";
import { routeTask } from "@/lib/ai/server/providerRouter";
import { runAnalysis, runCritique, runRewrite, type AgentCaller, type AgentName } from "@/lib/ai/server/agentPipeline";
import { MAX_CRITIC_ROUNDS, sanitizeAnswers, sanitizeCritique, sanitizeGapReport, sanitizeProfile } from "@/lib/ai/agents";
import { aiRateLimit } from "@/lib/ratelimit/guard";
import { requireVerifiedUser } from "@/lib/auth/guard";
import { bodyTooLarge, validateInputSize } from "@/lib/ai/server/limits";

export const runtime = "nodejs";

interface Body {
  /**
   * "analyze" → profile + gap report + questions.
   * "rewrite" → grounded CV using the answers (plus critic feedback on later rounds).
   * "critique" → recruiter + ATS review of a draft.
   */
  action?: "analyze" | "rewrite" | "critique";
  jobDescription?: string;
  cv?: CVData;
  /** Echoed back from the analyze step; re-sanitized here, never trusted. */
  profile?: Record<string, unknown>;
  report?: Record<string, unknown>;
  answers?: unknown;
  /** Feedback rewrite: the previous draft, the critique of it, and the round (1-based). */
  draft?: CVData;
  critique?: Record<string, unknown>;
  round?: number;
}

const hasShape = (c: unknown): c is CVData => {
  const v = c as Partial<CVData> | undefined;
  return !!v && !!v.basics && Array.isArray(v.experience) && Array.isArray(v.projects) && Array.isArray(v.skills) && Array.isArray(v.education) && Array.isArray(v.certifications);
};

const json = (error: string, status = 200) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const { provider } = routeTask("agent-analyze");

  const oversize = bodyTooLarge(req);
  if (oversize) return json(oversize, 413);
  const gate = await requireVerifiedUser("run the assistant");
  const limited = await aiRateLimit(req, provider, gate.ok ? gate.userId : null);
  if (limited) return limited;
  if (!gate.ok) return json(gate.message, gate.status);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json("Invalid request body.", 400);
  }
  const tooBig = validateInputSize(body) ?? validateInputSize({ cv: body.draft });
  if (tooBig) return json(tooBig, 413);
  if (!hasShape(body.cv)) return json("Missing CV data.", 400);
  if (body.draft !== undefined && !hasShape(body.draft)) return json("Invalid draft.", 400);
  const jobDescription = (body.jobDescription ?? "").trim();
  if (!jobDescription) return json("Paste a job description to refine against.", 400);

  const fake = fakeAiFor("openai") || fakeAiFor("anthropic");
  if (!fake && !serverKeyFor("openai") && !serverKeyFor("anthropic")) {
    return json(notConfiguredMessage(provider), 503);
  }

  const task: Record<AgentName, "agent-analyze" | "agent-rewrite"> = {
    analyst: "agent-analyze",
    gap: "agent-analyze",
    elicitor: "agent-analyze",
    critic: "agent-analyze",
    rewriter: "agent-rewrite",
  };
  const cv = body.cv;
  const call: AgentCaller = async (agent, system, user): Promise<ProviderCall> => {
    if (fake) return { ok: true, content: fakeAgentOutput(agent, cv, jobDescription) };
    const served = await runRoutedWithFailover(task[agent], { system, user, opts: { ...DETERMINISTIC, maxTokens: 2048 } });
    return served.call;
  };

  try {
    const profile = sanitizeProfile(body.profile ?? {});
    let result;
    if (body.action === "critique") {
      if (!body.draft) return json("Missing draft to review.", 400);
      result = await runCritique(body.draft, jobDescription, profile, call);
    } else if (body.action === "rewrite") {
      let feedback;
      if (body.round) {
        if (!Number.isInteger(body.round) || body.round < 1 || body.round > MAX_CRITIC_ROUNDS || !body.draft) {
          return json("Invalid refinement round.", 400);
        }
        feedback = { critique: sanitizeCritique(body.critique ?? {}, body.draft), previousDraft: body.draft };
      }
      result = await runRewrite(
        cv,
        jobDescription,
        profile,
        sanitizeGapReport(body.report ?? {}, cv),
        sanitizeAnswers(body.answers),
        call,
        feedback,
      );
    } else {
      result = await runAnalysis(cv, jobDescription, call);
    }
    if (!result.ok) {
      return json(`The ${result.agent} agent failed: ${result.message}`);
    }
    return NextResponse.json(result);
  } catch (e) {
    return json((e as Error).message);
  }
}

/** Dev-only mock output per agent (no provider key / ORIRE_FAKE_AI=1). */
function fakeAgentOutput(agent: AgentName, cv: CVData, jd: string): string {
  if (agent === "analyst") {
    return JSON.stringify({
      roleTitle: "Target role",
      seniority: "mid",
      mustHaves: ["Relevant experience"],
      niceToHaves: [],
      keywords: [],
      tone: "clear and metrics-driven",
    });
  }
  if (agent === "gap") {
    return JSON.stringify({
      matched: ["Relevant experience present"],
      understated: [{ area: "Quantified outcomes", advice: "Add measurable results where true." }],
      plausible: [],
      genuineGap: [],
      weakBullets: [],
    });
  }
  if (agent === "critic") {
    return JSON.stringify({
      recruiter: { issues: [], keepGoing: false },
      ats: { missingKeywords: [], parseRisks: [], keepGoing: false },
    });
  }
  if (agent === "elicitor") {
    return JSON.stringify({
      questions: [{ targets: "Quantified outcomes", prompt: "Pick one achievement: what changed, and by roughly how much?", kind: "metric" }],
    });
  }
  return fakeRefinePatch(cv, jd);
}
