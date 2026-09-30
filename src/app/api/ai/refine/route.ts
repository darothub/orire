/**
 * orire — AI refine proxy route (Node runtime).
 *
 * Receives the user's chosen provider + CV + job description, dispatches to the
 * provider server-side (BYO-key HTTPS, or the local Claude Code CLI), and
 * returns the raw model text. Provider errors are returned VERBATIM (req 12).
 */

import { NextResponse } from "next/server";
import type { CVData } from "@/lib/cv/schema";
import { PATCH_SYSTEM, buildPatchPrompt } from "@/lib/ai/prompt";
import { PROVIDERS, needsKey, isCLI, type ProviderId, type RefineResponse } from "@/lib/ai/types";
import { runProvider } from "@/lib/ai/server/providerCall";
import { verifyRunToken } from "@/lib/plan/runToken";
import { modelAllowedOnPlan } from "@/lib/plan/plan";

export const runtime = "nodejs";

interface Body {
  provider?: ProviderId;
  apiKey?: string;
  model?: string;
  jobDescription?: string;
  cv?: CVData;
  runToken?: string;
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
  const apiKey = (body.apiKey ?? "").trim();
  if (needsKey(provider) && !apiKey) {
    return NextResponse.json(fail(provider, "Missing API key. Add it in Settings."), { status: 400 });
  }
  const model = (body.model ?? "").trim();
  if (!model) {
    return NextResponse.json(fail(provider, "No model selected."), { status: 400 });
  }
  if (!body.cv) {
    return NextResponse.json(fail(provider, "Missing CV data."), { status: 400 });
  }
  if (!(body.jobDescription ?? "").trim()) {
    return NextResponse.json(fail(provider, "Paste a job description to refine against."), { status: 400 });
  }

  // Server-enforced gate (Phase B1): every provider call must carry a run token
  // minted by `authorizeRefineRun`, which checked the plan + usage in Postgres.
  const check = verifyRunToken(body.runToken);
  if (!check.ok) {
    return NextResponse.json(fail(provider, check.reason ?? "Run not authorized.", 403), { status: 403 });
  }
  if (!check.payload!.p.includes(provider)) {
    return NextResponse.json(
      fail(provider, "This assistant wasn’t part of the authorized run.", 403),
      { status: 403 }
    );
  }

  // Per-column model-tier enforcement, driven by the plan attested in the token.
  // `hasOwnKey` is what the server can actually see: a CLI provider or a key on
  // this request. Premium models on key-gated plans need that BYO key.
  const hasOwnKey = isCLI(provider) || apiKey.length > 0;
  const modelGate = modelAllowedOnPlan(check.payload!.plan, provider, model, hasOwnKey);
  if (!modelGate.allowed) {
    return NextResponse.json(
      fail(provider, modelGate.reason ?? "That model isn’t available on your plan.", 402),
      { status: 200 }
    );
  }

  const user = buildPatchPrompt(body.cv, body.jobDescription!);

  try {
    const out = await runProvider({ provider, apiKey, model, system: PATCH_SYSTEM, user });
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
