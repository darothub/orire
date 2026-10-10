/**
 * orire — AI CV-structuring route (Node runtime).
 *
 * Takes raw text extracted from an uploaded CV plus the user's chosen provider,
 * asks it to structure the text into the CV JSON schema, and returns a typed
 * ParsedCV. This is the AI path for "Replace editor" — far more accurate than
 * the heuristic parser, while still fact-grounded (the model is told to use only
 * text present in the document; see STRUCTURE_SYSTEM).
 *
 * Provider errors are captured and returned VERBATIM (req 12).
 */

import { NextResponse } from "next/server";
import { STRUCTURE_SYSTEM, buildStructurePrompt } from "@/lib/ai/prompt";
import { parseModelJSON } from "@/lib/ai/guardrails";
import { parsedCVFromModelJSON, type ParsedCV } from "@/lib/ingest/parse";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";
import { runProvider, DETERMINISTIC } from "@/lib/ai/server/providerCall";
import { serverKeyFor, notConfiguredMessage } from "@/lib/ai/server/serverKey";
import { requireVerifiedUser } from "@/lib/auth/guard";
import { aiRateLimit } from "@/lib/ratelimit/guard";
import { bodyTooLarge, validateInputSize } from "@/lib/ai/server/limits";

export const runtime = "nodejs";

interface Body {
  provider?: ProviderId;
  model?: string;
  text?: string;
}

export interface StructureResponse {
  ok: boolean;
  provider: ProviderId;
  model: string;
  parsed?: ParsedCV;
  error?: { provider: ProviderId; status?: number; message: string };
}

function fail(provider: ProviderId, message: string, status?: number): StructureResponse {
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

  const limited = aiRateLimit(req, provider);
  if (limited) return limited;
  const oversize = bodyTooLarge(req) ?? validateInputSize(body);
  if (oversize) return NextResponse.json(fail(provider, oversize, 413), { status: 413 });

  // Require a signed-in, verified user before spending managed AI keys.
  const gate = await requireVerifiedUser();
  if (!gate.ok) {
    return NextResponse.json(fail(provider, gate.message, gate.status), { status: 200 });
  }

  const apiKey = serverKeyFor(provider);
  if (!apiKey) {
    return NextResponse.json(fail(provider, notConfiguredMessage(provider), 503), { status: 200 });
  }
  const model = (body.model ?? "").trim();
  if (!model) {
    return NextResponse.json(fail(provider, "No model selected."), { status: 400 });
  }
  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json(fail(provider, "No CV text to structure."), { status: 400 });
  }

  const user = buildStructurePrompt(text);

  try {
    const out = await runProvider({
      provider,
      apiKey,
      model,
      system: STRUCTURE_SYSTEM,
      user,
      opts: DETERMINISTIC,
    });

    if (!out.ok) {
      return NextResponse.json(
        { ok: false, provider, model, error: { provider, status: out.status, message: out.body } } as StructureResponse,
        { status: 200 }
      );
    }

    let parsed: ParsedCV;
    try {
      parsed = parsedCVFromModelJSON(parseModelJSON(out.content));
    } catch (e) {
      return NextResponse.json(
        { ok: false, provider, model, error: { provider, message: (e as Error).message } } as StructureResponse,
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, provider, model, parsed } as StructureResponse, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, provider, model, error: { provider, message: (e as Error).message } } as StructureResponse,
      { status: 200 }
    );
  }
}
