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
import { DETERMINISTIC, type ProviderCall } from "@/lib/ai/server/providerCall";
import { serverKeyFor, notConfiguredMessage } from "@/lib/ai/server/serverKey";
import { fakeAiFor, fakeSimulatedCV } from "@/lib/ai/server/fakeProvider";
import { routeTask } from "@/lib/ai/server/providerRouter";
import { runRoutedWithFailover } from "@/lib/ai/server/failover";
import { aiRateLimit } from "@/lib/ratelimit/guard";
import { requireVerifiedUser } from "@/lib/auth/guard";
import { bodyTooLarge, validateInputSize } from "@/lib/ai/server/limits";
import { getPlanId, getUsed, consume, refund } from "@/lib/entitlement/entitlement";
import { withinCap, meterFor } from "@/lib/plan/plan";

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
  // Needs at least one managed provider key (either can serve via failover),
  // unless the dev mock is active.
  if (!fakeAiFor(provider) && !serverKeyFor("openai") && !serverKeyFor("anthropic")) {
    return NextResponse.json(fail(provider, notConfiguredMessage(provider), 503), { status: 200 });
  }
  if (!(body.jobDescription ?? "").trim()) {
    return NextResponse.json(fail(provider, "Missing job description."), { status: 400 });
  }

  // Usage gate: Free gets a lifetime simulate; paid plans are unlimited. The
  // count is server-authoritative (UsageCounter), so it can't be reset from the
  // client. Enforced here because this route is the only path to the managed key.
  const { userId } = gate;
  const plan = await getPlanId(userId);
  const used = await getUsed(userId, "simulate", plan);
  const capGate = withinCap(plan, "simulate", used);
  if (!capGate.allowed) {
    return NextResponse.json(
      fail(provider, capGate.reason ?? "You’ve used your free simulation. Upgrade to Pro to simulate more.", 402),
      { status: 200 }
    );
  }
  const metered = meterFor(plan, "simulate").cap !== null;

  const user = buildSimulatePrompt(body.jobDescription!);

  // Consume up-front so concurrent requests can't both slip past the cap, then
  // refund if the run fails — only a successful simulation spends the credit.
  if (metered) await consume(userId, "simulate", plan);

  try {
    let out: ProviderCall;
    let servedProvider = provider;
    let servedModel = model;
    if (fakeAiFor(provider)) {
      out = { ok: true, content: fakeSimulatedCV(body.jobDescription!) };
    } else {
      const served = await runRoutedWithFailover("simulate", { system: SIMULATE_SYSTEM, user, opts: DETERMINISTIC });
      out = served.call;
      servedProvider = served.provider;
      servedModel = served.model;
    }
    if (!out.ok) {
      if (metered) await refund(userId, "simulate", plan);
      return NextResponse.json(
        { ok: false, provider: servedProvider, model: servedModel, error: { provider: servedProvider, status: out.status, message: out.body } } as RefineResponse,
        { status: 200 }
      );
    }
    return NextResponse.json({ ok: true, provider: servedProvider, model: servedModel, raw: out.content } as RefineResponse, { status: 200 });
  } catch (e) {
    if (metered) await refund(userId, "simulate", plan);
    return NextResponse.json(
      { ok: false, provider, model, error: { provider, message: (e as Error).message } } as RefineResponse,
      { status: 200 }
    );
  }
}
