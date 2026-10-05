/**
 * orire — provider model list (Node runtime).
 *
 * orire runs on managed server keys, so the UI no longer discovers models with
 * a user key. This returns orire's curated, plan-gateable model list for a
 * provider. Premium models are still enforced server-side at run time.
 */

import { NextResponse } from "next/server";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";

export const runtime = "nodejs";

interface Body {
  provider?: ProviderId;
}

export interface ModelsResponse {
  ok: boolean;
  provider: ProviderId;
  models?: string[];
  error?: { provider: ProviderId; status?: number; message: string };
}

function fail(provider: ProviderId, message: string, status?: number): ModelsResponse {
  return { ok: false, provider, error: { provider, message, status } };
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(fail("openai", "Invalid JSON body."), { status: 400 });
  }
  const { provider } = body;
  if (!provider || !(provider in PROVIDERS)) {
    return NextResponse.json(fail("openai", "Unknown provider."), { status: 400 });
  }
  return NextResponse.json({ ok: true, provider, models: PROVIDERS[provider].models } as ModelsResponse);
}
