/**
 * orire — AI CV-structuring route (Node runtime).
 *
 * Takes raw text extracted from an uploaded CV plus the user's BYO key, asks the
 * chosen provider to structure it into the CV JSON schema, and returns a typed
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
import type { ProviderId } from "@/lib/ai/types";

export const runtime = "nodejs";

interface Body {
  provider?: ProviderId;
  apiKey?: string;
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

async function callOpenAI(key: string, model: string, system: string, user: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false as const, status: res.status, body: text };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false as const, status: res.status, body: text };
  }
  const content: string =
    (data as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content ?? "";
  return { ok: true as const, content };
}

async function callAnthropic(key: string, model: string, system: string, user: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      temperature: 0,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false as const, status: res.status, body: text };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false as const, status: res.status, body: text };
  }
  const blocks = (data as { content?: { text?: string }[] })?.content;
  const content: string = Array.isArray(blocks) ? blocks.map((b) => b?.text ?? "").join("") : "";
  return { ok: true as const, content };
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(fail("openai", "Invalid request body."), { status: 400 });
  }

  const provider = body.provider;
  if (provider !== "openai" && provider !== "anthropic") {
    return NextResponse.json(fail("openai", "Unknown provider."), { status: 400 });
  }
  const apiKey = (body.apiKey ?? "").trim();
  if (!apiKey) {
    return NextResponse.json(fail(provider, "Missing API key. Add it in Settings."), { status: 400 });
  }
  const model = (body.model ?? "").trim();
  if (!model) {
    return NextResponse.json(fail(provider, "No model selected."), { status: 400 });
  }
  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json(fail(provider, "No CV text to structure."), { status: 400 });
  }

  const system = STRUCTURE_SYSTEM;
  const user = buildStructurePrompt(text);

  try {
    const out =
      provider === "openai"
        ? await callOpenAI(apiKey, model, system, user)
        : await callAnthropic(apiKey, model, system, user);

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
