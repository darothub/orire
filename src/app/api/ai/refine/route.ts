/**
 * orire — AI refine proxy route (Node runtime).
 *
 * Receives the user's chosen provider + CV + job description, dispatches to the
 * provider server-side (BYO-key HTTPS, or the local Claude Code CLI), and
 * returns the raw model text. Provider errors are returned VERBATIM (req 12).
 */

import { NextResponse } from "next/server";
import type { CVData } from "@/lib/cv/schema";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/prompt";
import { PROVIDERS, needsKey, type ProviderId, type RefineResponse } from "@/lib/ai/types";
import { runProvider } from "@/lib/ai/server/providerCall";

export const runtime = "nodejs";

interface Body {
  provider?: ProviderId;
  apiKey?: string;
  model?: string;
  jobDescription?: string;
  cv?: CVData;
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

  const user = buildUserPrompt(body.cv, body.jobDescription!);

  try {
    const out = await runProvider({ provider, apiKey, model, system: SYSTEM_PROMPT, user });
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
