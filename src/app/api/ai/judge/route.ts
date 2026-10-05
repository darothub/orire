/**
 * orire — LLM-as-judge proxy route (Node runtime).
 *
 * Sends the job description + candidate CVs to the chosen provider and returns
 * the raw verdict JSON. Provider errors are captured VERBATIM (req 12).
 */

import { NextResponse } from "next/server";
import { JUDGE_SYSTEM, buildJudgePrompt, type JudgeCandidate } from "@/lib/ai/judge";
import { PROVIDERS, type ProviderId, type RefineResponse } from "@/lib/ai/types";
import { runProvider, DETERMINISTIC } from "@/lib/ai/server/providerCall";
import { serverKeyFor, notConfiguredMessage } from "@/lib/ai/server/serverKey";

export const runtime = "nodejs";

interface Body {
  provider?: ProviderId;
  model?: string;
  jobDescription?: string;
  candidates?: JudgeCandidate[];
}

function fail(provider: ProviderId, message: string, status?: number): RefineResponse {
  return { ok: false, provider, model: "", error: { provider, message, status } };
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(fail("openai", "Invalid request body."), { status: 400 });
  }

  const provider = body.provider;
  if (!provider || !(provider in PROVIDERS)) {
    return NextResponse.json(fail("openai", "Unknown provider."), { status: 400 });
  }
  const apiKey = serverKeyFor(provider);
  if (!apiKey) {
    return NextResponse.json(fail(provider, notConfiguredMessage(provider), 503), { status: 200 });
  }
  const model = (body.model ?? "").trim();
  if (!model) {
    return NextResponse.json(fail(provider, "No model selected."), { status: 400 });
  }
  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  if (candidates.length < 2) {
    return NextResponse.json(fail(provider, "Need at least two candidates to judge."), { status: 400 });
  }
  if (!(body.jobDescription ?? "").trim()) {
    return NextResponse.json(fail(provider, "Missing job description."), { status: 400 });
  }

  const user = buildJudgePrompt(body.jobDescription!, candidates);

  try {
    const out = await runProvider({
      provider,
      apiKey,
      model,
      system: JUDGE_SYSTEM,
      user,
      opts: { ...DETERMINISTIC, maxTokens: 2048 },
    });
    if (!out.ok) {
      return NextResponse.json(
        { ok: false, provider, model, error: { provider, status: out.status, message: out.body } } as RefineResponse,
        { status: 200 }
      );
    }
    return NextResponse.json({ ok: true, provider, model, raw: out.content } as RefineResponse, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, provider, model, error: { provider, message: (e as Error).message } } as RefineResponse,
      { status: 200 }
    );
  }
}
