/**
 * orire — provider model discovery (Node runtime).
 *
 * Given a BYO key, ask the provider itself which models the key can use, so the
 * UI populates real, currently-valid model IDs instead of a hand-maintained
 * preset list that goes stale (e.g. a renamed/retired Claude model returning
 * not_found_error). Errors are returned VERBATIM (req 12).
 */

import { NextResponse } from "next/server";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";

export const runtime = "nodejs";

interface Body {
  provider?: ProviderId;
  apiKey?: string;
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

/** Keep chat/completion-capable models; drop embeddings, audio, image, moderation, etc. */
function isOpenAIChatModel(id: string): boolean {
  if (/embedding|whisper|tts|audio|image|dall-e|moderation|realtime|transcribe|search|codex|davinci|babbage/i.test(id)) {
    return false;
  }
  return /^(gpt-|o\d|chatgpt)/i.test(id);
}

async function listOpenAI(key: string): Promise<ModelsResponse> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { authorization: `Bearer ${key}` },
  });
  const text = await res.text();
  if (!res.ok) return fail("openai", text, res.status);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return fail("openai", text, res.status);
  }
  const rows = (data as { data?: { id?: string }[] })?.data ?? [];
  const models = rows
    .map((r) => r.id ?? "")
    .filter((id) => id && isOpenAIChatModel(id))
    .sort((a, b) => a.localeCompare(b));
  return { ok: true, provider: "openai", models };
}

async function listAnthropic(key: string): Promise<ModelsResponse> {
  const res = await fetch("https://api.anthropic.com/v1/models?limit=1000", {
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
  });
  const text = await res.text();
  if (!res.ok) return fail("anthropic", text, res.status);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return fail("anthropic", text, res.status);
  }
  const rows = (data as { data?: { id?: string }[] })?.data ?? [];
  const models = rows.map((r) => r.id ?? "").filter(Boolean);
  // Anthropic returns newest first; keep that order.
  return { ok: true, provider: "anthropic", models };
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(fail("openai", "Invalid JSON body."), { status: 400 });
  }
  const { provider, apiKey } = body;
  if (!provider || !(provider in PROVIDERS)) {
    return NextResponse.json(fail("openai", "Unknown provider."), { status: 400 });
  }
  if (!apiKey?.trim()) {
    return NextResponse.json(fail(provider, "Add an API key first."), { status: 400 });
  }
  try {
    const out = provider === "openai" ? await listOpenAI(apiKey) : await listAnthropic(apiKey);
    return NextResponse.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(fail(provider, msg), { status: 502 });
  }
}
