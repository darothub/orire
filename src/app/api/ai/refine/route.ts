/**
 * orire — AI refine proxy route (Node runtime).
 *
 * Receives the user's chosen provider + CV + job description, dispatches to the
 * provider server-side on orire's managed key, and returns the raw model text.
 * Provider errors are returned VERBATIM (req 12).
 */

import { NextResponse } from "next/server";
import type { CVData } from "@/lib/cv/schema";
import { PATCH_SYSTEM, buildPatchPrompt } from "@/lib/ai/prompt";
import { PROVIDERS, type ProviderId, type RefineResponse } from "@/lib/ai/types";
import { runProvider, DETERMINISTIC } from "@/lib/ai/server/providerCall";
import { serverKeyFor, notConfiguredMessage } from "@/lib/ai/server/serverKey";
import { fakeAiFor, fakeRefinePatch } from "@/lib/ai/server/fakeProvider";
import { verifyRunToken } from "@/lib/plan/runToken";
import { modelAllowedOnPlan, meterFor, type PlanId } from "@/lib/plan/plan";
import { aiRateLimit } from "@/lib/ratelimit/guard";
import { bodyTooLarge, validateInputSize } from "@/lib/ai/server/limits";
import { prisma } from "@/lib/db/prisma";
import { consume } from "@/lib/entitlement/entitlement";

/**
 * Consume one refine for this run — but only once, and only when a provider
 * call actually succeeds. The run id (from the signed token) is claimed in an
 * idempotency ledger; the first success claims it and spends the credit, so a
 * two-column compare costs exactly one and a fully-failed run costs nothing.
 * Best-effort: a counter write failure never blocks the user's result.
 */
async function consumeRefineOnce(payload: { u: string | null; plan: PlanId; r: string }) {
  const { u: userId, plan, r: runId } = payload;
  if (!userId || !runId) return; // anonymous/legacy token — not metered here
  if (meterFor(plan, "refine").cap === null) return; // unlimited plan — not metered
  try {
    const claim = await prisma.consumedRefineRun.createMany({
      data: [{ runId, userId }],
      skipDuplicates: true,
    });
    if (claim.count === 1) {
      await consume(userId, "refine", plan);
    }
  } catch {
    // Swallow: under-counting on a transient DB error is acceptable; never fail
    // the response the user already paid for with a successful model call.
  }
}

export const runtime = "nodejs";

interface Body {
  provider?: ProviderId;
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

  // Honour the caller's selected assistant (validated below against the run
  // token's authorized set) so a two-assistant comparison actually runs two
  // different providers instead of being silently collapsed onto one. The model
  // is plan-gated by modelAllowedOnPlan further down.
  const provider = body.provider;
  if (!provider || !(provider in PROVIDERS)) {
    return NextResponse.json(fail("openai", "Unknown assistant."), { status: 400 });
  }
  const model = (body.model ?? "").trim();

  const limited = await aiRateLimit(req, provider);
  if (limited) return limited;
  const oversize = bodyTooLarge(req) ?? validateInputSize(body);
  if (oversize) return NextResponse.json(fail(provider, oversize, 413), { status: 413 });
  // Managed key: orire holds the provider key server-side. In dev mock mode
  // (ORIRE_FAKE_AI=1, never production) we don't need one.
  const apiKey = serverKeyFor(provider);
  if (!fakeAiFor(provider) && !apiKey) {
    return NextResponse.json(fail(provider, notConfiguredMessage(provider), 503), { status: 200 });
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
      fail(provider, "This assistant wasn't part of the authorized run.", 403),
      { status: 403 }
    );
  }

  if (!model) {
    return NextResponse.json(fail(provider, "No model selected."), { status: 400 });
  }

  // Per-column model-tier enforcement, driven by the plan attested in the token.
  const modelGate = modelAllowedOnPlan(check.payload!.plan, provider, model);
  if (!modelGate.allowed) {
    return NextResponse.json(
      fail(provider, modelGate.reason ?? "That model isn't available on your plan.", 402),
      { status: 200 }
    );
  }

  const user = buildPatchPrompt(body.cv, body.jobDescription!);

  try {
    const out = fakeAiFor(provider)
      ? { ok: true as const, content: fakeRefinePatch(body.cv!, body.jobDescription!) }
      : await runProvider({ provider, apiKey: apiKey ?? "", model, system: PATCH_SYSTEM, user, opts: DETERMINISTIC });
    if (!out.ok) {
      return NextResponse.json(
        { ok: false, provider, model, error: { provider, status: out.status, message: out.body } } as RefineResponse,
        { status: 200 }
      );
    }
    // Success: consume the refine (once per run, metered plans only).
    await consumeRefineOnce(check.payload!);
    return NextResponse.json({ ok: true, provider, model, raw: out.content } as RefineResponse, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, provider, model, error: { provider, message: (e as Error).message } } as RefineResponse,
      { status: 200 }
    );
  }
}
