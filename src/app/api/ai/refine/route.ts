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
import { runProvider, DETERMINISTIC, type ProviderCall } from "@/lib/ai/server/providerCall";
import { serverKeyFor, notConfiguredMessage } from "@/lib/ai/server/serverKey";
import { fakeAiFor, fakeRefinePatch } from "@/lib/ai/server/fakeProvider";
import { isAvailabilityFailure } from "@/lib/ai/server/failover";
import { verifyRunToken } from "@/lib/plan/runToken";
import { modelAllowedOnPlan, meterFor, type PlanId } from "@/lib/plan/plan";
import { aiRateLimit } from "@/lib/ratelimit/guard";
import { requireVerifiedUser } from "@/lib/auth/guard";
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

  // P1 browse-only: re-check verify at execution time (token mint alone is not enough).
  const gate = await requireVerifiedUser("run refine");
  if (!gate.ok) {
    return NextResponse.json(fail(provider, gate.message, gate.status), { status: 200 });
  }
  if (check.payload!.u && check.payload!.u !== gate.userId) {
    return NextResponse.json(
      fail(provider, "This refine run belongs to a different account.", 403),
      { status: 403 },
    );
  }

  // Rate-limit after the token is verified so signed-in runs key on the stable
  // user id from the token (anonymous free trials still fall back to IP).
  const limited = await aiRateLimit(req, provider, check.payload!.u ?? gate.userId);
  if (limited) return limited;

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

  // One provider attempt on orire's managed key (or the dev mock). The prompt
  // is provider-agnostic and deterministic, so a failover produces a comparable,
  // identically fact-grounded patch.
  const callOnce = async (p: ProviderId, m: string): Promise<ProviderCall> => {
    if (fakeAiFor(p)) return { ok: true, content: fakeRefinePatch(body.cv!, body.jobDescription!) };
    const key = serverKeyFor(p);
    if (!key) return { ok: false, status: 503, body: notConfiguredMessage(p) };
    return runProvider({ provider: p, apiKey: key, model: m, system: PATCH_SYSTEM, user, opts: DETERMINISTIC });
  };

  try {
    const primary = await callOnce(provider, model);
    let served: { provider: ProviderId; model: string; call: ProviderCall } = { provider, model, call: primary };

    // Transparent failover: if the chosen assistant is UNAVAILABLE (5xx/429/
    // timeout — a deterministic 4xx is returned as-is) and the run token carries
    // a pre-authorized, plan-permitted fallback, serve from the other managed
    // provider instead of surfacing an outage. Authorized only for single-
    // provider runs (a compare already runs both), so this never duplicates a
    // column the user is also comparing.
    const fb = check.payload!.f;
    if (
      !primary.ok &&
      isAvailabilityFailure(primary) &&
      fb != null &&
      fb.provider !== provider &&
      (fakeAiFor(fb.provider) || serverKeyFor(fb.provider) != null)
    ) {
      const fbCall = await callOnce(fb.provider, fb.model);
      if (fbCall.ok) served = { provider: fb.provider, model: fb.model, call: fbCall };
      // If the fallback also fails, keep the PRIMARY error below — the user
      // chose that assistant, so that's the verbatim error they should see.
    }

    if (!served.call.ok) {
      // Report the chosen assistant's verbatim error (req 12), not the backup's.
      // served.call not-ok implies the primary failed too (a successful fallback
      // would have replaced it), so `primary` is the error variant here.
      const err = !primary.ok ? { status: primary.status, message: primary.body } : { message: "Refine failed." };
      return NextResponse.json(
        { ok: false, provider, model, error: { provider, ...err } } as RefineResponse,
        { status: 200 }
      );
    }
    // Success: consume the refine (once per run, metered plans only) regardless
    // of which managed provider ultimately served it.
    await consumeRefineOnce(check.payload!);
    const fellBack = served.provider !== provider;
    return NextResponse.json(
      {
        ok: true,
        provider,
        model: served.model,
        raw: served.call.content,
        ...(fellBack ? { servedBy: served.provider } : {}),
      } as RefineResponse,
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, provider, model, error: { provider, message: (e as Error).message } } as RefineResponse,
      { status: 200 }
    );
  }
}
