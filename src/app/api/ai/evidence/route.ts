/**
 * orire — evidence route (Node runtime). Drafts one measurable CV bullet from
 * the user's own answers. Numbers are verified against the answers before the
 * draft is returned, so a model-invented figure never reaches the CV.
 */

import { NextResponse } from "next/server";
import {
  EVIDENCE_SYSTEM,
  buildEvidencePrompt,
  numbersGrounded,
  parseEvidenceBullet,
  type EvidenceInput,
} from "@/lib/ai/evidence";
import { DETERMINISTIC, type ProviderCall } from "@/lib/ai/server/providerCall";
import { runRoutedWithFailover } from "@/lib/ai/server/failover";
import { serverKeyFor, notConfiguredMessage } from "@/lib/ai/server/serverKey";
import { fakeAiFor, fakeEvidenceBullet } from "@/lib/ai/server/fakeProvider";
import { routeTask } from "@/lib/ai/server/providerRouter";
import { aiRateLimit } from "@/lib/ratelimit/guard";
import { requireVerifiedUser } from "@/lib/auth/guard";
import { bodyTooLarge } from "@/lib/ai/server/limits";

export const runtime = "nodejs";

const FIELD_MAX = 600;
const clean = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, FIELD_MAX) : "");

const json = (error: string, status = 200) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const { provider } = routeTask("evidence");

  const limited = await aiRateLimit(req, provider);
  if (limited) return limited;
  const oversize = bodyTooLarge(req);
  if (oversize) return json(oversize, 413);
  const gate = await requireVerifiedUser();
  if (!gate.ok) return json(gate.message, gate.status);

  let raw: Partial<Record<keyof EvidenceInput, unknown>>;
  try {
    raw = await req.json();
  } catch {
    return json("Invalid request body.", 400);
  }
  const input: EvidenceInput = {
    role: clean(raw.role),
    company: clean(raw.company),
    action: clean(raw.action),
    scale: clean(raw.scale),
    result: clean(raw.result),
    timeframe: clean(raw.timeframe),
  };
  if (!input.action) return json("Tell us what you did first.", 400);

  if (!fakeAiFor(provider) && !serverKeyFor("openai") && !serverKeyFor("anthropic")) return json(notConfiguredMessage(provider));

  try {
    let out: ProviderCall;
    if (fakeAiFor(provider)) {
      out = { ok: true, content: fakeEvidenceBullet(input) };
    } else {
      out = (await runRoutedWithFailover("evidence", { system: EVIDENCE_SYSTEM, user: buildEvidencePrompt(input), opts: DETERMINISTIC })).call;
    }
    if (!out.ok) return json(out.body);
    const bullet = parseEvidenceBullet(out.content);
    if (!bullet) return json("Couldn't draft a bullet. Try rewording your answers.");
    if (!numbersGrounded(bullet, input)) {
      return json("The draft used a figure you didn't provide, so we discarded it. Add the real numbers and try again.");
    }
    return NextResponse.json({ ok: true, bullet });
  } catch (e) {
    return json((e as Error).message);
  }
}
