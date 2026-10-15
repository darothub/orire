/**
 * orire — LLM-as-judge proxy route (Node runtime).
 *
 * Sends the job description + candidate CVs to the chosen provider and returns
 * the raw verdict JSON. Provider errors are captured VERBATIM (req 12).
 */

import { NextResponse } from "next/server";
import { JUDGE_SYSTEM, buildJudgePrompt, type JudgeCandidate } from "@/lib/ai/judge";
import { type ProviderId, type RefineResponse } from "@/lib/ai/types";
import { runProvider, DETERMINISTIC } from "@/lib/ai/server/providerCall";
import { serverKeyFor, notConfiguredMessage } from "@/lib/ai/server/serverKey";
import { routeTask } from "@/lib/ai/server/providerRouter";
import { aiRateLimit } from "@/lib/ratelimit/guard";
import { requireVerifiedUser } from "@/lib/auth/guard";
import { bodyTooLarge, validateInputSize } from "@/lib/ai/server/limits";
import { getPlanId } from "@/lib/entitlement/entitlement";
import { PLANS } from "@/lib/plan/plan";

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

  // Automatic provider routing: ignore client-provided provider/model
  const route = routeTask("judge");
  const provider = route.provider;
  const model = route.model;

  const limited = await aiRateLimit(req, provider);
  if (limited) return limited;
  const oversize = bodyTooLarge(req) ?? validateInputSize(body);
  if (oversize) return NextResponse.json(fail(provider, oversize, 413), { status: 413 });
  const gate = await requireVerifiedUser();
  if (!gate.ok) return NextResponse.json(fail(provider, gate.message, gate.status), { status: 200 });
  // "Help me pick the best" is a paid feature (it rides on the compare flow,
  // which is Pro+). Enforce it here too so a direct call can't spend the
  // managed key on a Free account.
  const plan = await getPlanId(gate.userId);
  if (!PLANS[plan].allowCompare) {
    return NextResponse.json(
      fail(provider, "Picking the best version is a Pro feature. Upgrade to Pro to compare and pick the best.", 402),
      { status: 200 },
    );
  }
  const apiKey = serverKeyFor(provider);
  if (!apiKey) {
    return NextResponse.json(fail(provider, notConfiguredMessage(provider), 503), { status: 200 });
  }
  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  if (candidates.length < 2) {
    return NextResponse.json(fail(provider, "Need at least two versions to pick the best."), { status: 400 });
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
