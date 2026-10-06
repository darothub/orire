/**
 * orire — cover letter proxy route (Node runtime, CL-1).
 *
 * Sends the candidate CV + job description to the chosen provider and returns
 * the raw JSON for a tailored, fact-grounded cover letter. Provider errors are
 * captured VERBATIM (req 12).
 *
 * Cover letters are a paid add-on: this route is server-gated on the caller's
 * effective plan (Pro and up). Free users receive a 402-style block in the
 * response body so the client can surface an upsell.
 */

import { NextResponse } from "next/server";
import { COVER_LETTER_SYSTEM, buildCoverLetterPrompt, type CoverLetterTone } from "@/lib/ai/coverLetter";
import { PROVIDERS, type ProviderId, type RefineResponse } from "@/lib/ai/types";
import { runProvider, DETERMINISTIC } from "@/lib/ai/server/providerCall";
import { serverKeyFor, notConfiguredMessage } from "@/lib/ai/server/serverKey";
import { routeTask } from "@/lib/ai/server/providerRouter";
import type { CVData } from "@/lib/cv/schema";
import { auth } from "@/lib/auth/auth";
import { getPlanId } from "@/lib/entitlement/entitlement";
import { allowCoverLetter } from "@/lib/plan/plan";
import { aiRateLimit } from "@/lib/ratelimit/guard";
import { bodyTooLarge, validateInputSize } from "@/lib/ai/server/limits";

export const runtime = "nodejs";

interface Body {
  provider?: ProviderId;
  model?: string;
  cv?: CVData;
  jobDescription?: string;
  tone?: CoverLetterTone;
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
  const route = routeTask("cover-letter");
  const provider = route.provider;
  const model = route.model;

  const limited = aiRateLimit(req, provider);
  if (limited) return limited;
  const oversize = bodyTooLarge(req) ?? validateInputSize(body);
  if (oversize) return NextResponse.json(fail(provider, oversize, 413), { status: 413 });

  // Server-authoritative plan gate (Pro+). Free users get an upsell block.
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const plan = userId ? await getPlanId(userId) : "free";
  if (!allowCoverLetter(plan)) {
    return NextResponse.json(
      fail(provider, "Cover letters are a Pro feature. Upgrade your plan to generate one.", 402),
      { status: 200 }
    );
  }

  const apiKey = serverKeyFor(provider);
  if (!apiKey) {
    return NextResponse.json(fail(provider, notConfiguredMessage(provider), 503), { status: 200 });
  }
  if (!body.cv || typeof body.cv !== "object") {
    return NextResponse.json(fail(provider, "Missing CV."), { status: 400 });
  }
  if (!(body.jobDescription ?? "").trim()) {
    return NextResponse.json(fail(provider, "Missing job description."), { status: 400 });
  }

  const user = buildCoverLetterPrompt(body.cv, body.jobDescription!, { tone: body.tone });

  try {
    const out = await runProvider({
      provider,
      apiKey,
      model,
      system: COVER_LETTER_SYSTEM,
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
