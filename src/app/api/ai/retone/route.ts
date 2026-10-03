/**
 * orire — tone-transfer proxy route (Node runtime).
 *
 * Rewrites the user's CV in a target VOICE (executive/technical) and returns the
 * raw patch JSON. The target tone is supplied as a deterministic profile +
 * style exemplars — never as a source of facts. Provider errors are captured
 * VERBATIM (req 12). Grounding happens client-side via applyRefinePatch +
 * factGround, so nothing borrowed from the target survives.
 */

import { NextResponse } from "next/server";
import { RETONE_SYSTEM, buildRetonePrompt, type ToneProfile } from "@/lib/ai/retone";
import { PROVIDERS, needsKey, type ProviderId, type RefineResponse } from "@/lib/ai/types";
import { runProvider, DETERMINISTIC } from "@/lib/ai/server/providerCall";
import { effectiveProviderKey } from "@/lib/ai/server/pooledKey";
import type { CVData } from "@/lib/cv/schema";

export const runtime = "nodejs";

interface Body {
  provider?: ProviderId;
  apiKey?: string;
  model?: string;
  cv?: CVData;
  tone?: ToneProfile;
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
  const apiKey = await effectiveProviderKey(provider, body.apiKey ?? "");
  if (needsKey(provider) && !apiKey) {
    return NextResponse.json(fail(provider, "Missing API key. Add it in Settings."), { status: 400 });
  }
  const model = (body.model ?? "").trim();
  if (!model) {
    return NextResponse.json(fail(provider, "No model selected."), { status: 400 });
  }
  if (!body.cv || !Array.isArray(body.cv.experience)) {
    return NextResponse.json(fail(provider, "Missing source CV."), { status: 400 });
  }
  if (!body.tone || !body.tone.label) {
    return NextResponse.json(fail(provider, "Missing target tone."), { status: 400 });
  }

  const user = buildRetonePrompt(body.cv, body.tone);

  try {
    const out = await runProvider({
      provider,
      apiKey,
      model,
      system: RETONE_SYSTEM,
      user,
      opts: DETERMINISTIC,
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
