/**
 * orire — JD simulation proxy route (Node runtime, req 20).
 *
 * Sends a job description to the chosen provider and returns the raw JSON for a
 * synthetic "ideal candidate" CV. Provider errors are captured VERBATIM (req 12).
 * The result is a benchmark only — it is never grounded into the user's CV.
 */

import { NextResponse } from "next/server";
import { SIMULATE_SYSTEM, buildSimulatePrompt } from "@/lib/ai/simulate";
import { type ProviderId, type RefineResponse } from "@/lib/ai/types";
import { runProvider, DETERMINISTIC } from "@/lib/ai/server/providerCall";
import { serverKeyFor, notConfiguredMessage } from "@/lib/ai/server/serverKey";
import { routeTask } from "@/lib/ai/server/providerRouter";
import { aiRateLimit } from "@/lib/ratelimit/guard";
import { requireVerifiedUser } from "@/lib/auth/guard";
import { bodyTooLarge, validateInputSize } from "@/lib/ai/server/limits";

export const runtime = "nodejs";

interface Body {
  provider?: ProviderId;
  model?: string;
  jobDescription?: string;
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
  const route = routeTask("simulate");
  const provider = route.provider;
  const model = route.model;

  const limited = await aiRateLimit(req, provider);
  if (limited) return limited;
  const oversize = bodyTooLarge(req) ?? validateInputSize(body);
  if (oversize) return NextResponse.json(fail(provider, oversize, 413), { status: 413 });
  const gate = await requireVerifiedUser();
  if (!gate.ok) return NextResponse.json(fail(provider, gate.message, gate.status), { status: 200 });
  const apiKey = serverKeyFor(provider);
  if (!apiKey) {
    return NextResponse.json(fail(provider, notConfiguredMessage(provider), 503), { status: 200 });
  }
  if (!(body.jobDescription ?? "").trim()) {
    return NextResponse.json(fail(provider, "Missing job description."), { status: 400 });
  }

  const user = buildSimulatePrompt(body.jobDescription!);

  try {
    const out = await runProvider({
      provider,
      apiKey,
      model,
      system: SIMULATE_SYSTEM,
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
