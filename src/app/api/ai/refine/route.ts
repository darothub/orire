/**
 * orire — AI refine proxy route (Node runtime).
 *
 * Receives the user's BYO key + CV + job description, calls the chosen provider
 * server-side (avoids browser CORS and keeps the key out of any third party
 * other than the provider itself), and returns the raw model text.
 *
 * Provider errors are captured and returned VERBATIM (req 12) — never rewritten.
 */

import { NextResponse } from "next/server";
import type { CVData } from "@/lib/cv/schema";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/prompt";
import type { ProviderId, RefineResponse } from "@/lib/ai/types";

export const runtime = "nodejs";

interface Body {
  provider?: ProviderId;
  apiKey?: string;
  model?: string;
  jobDescription?: string;
  cv?: CVData;
}

function fail(provider: ProviderId, message: string, status?: number): RefineResponse {
  return { ok: false, provider, model: "", error: { provider, message, status } };
}

async function callOpenAI(key: string, model: string, system: string, user: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
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
    // 2xx but not JSON (e.g. an intercepting proxy) — surface the body verbatim.
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
      max_tokens: 4096,
      temperature: 0.2,
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
  const content: string = Array.isArray(blocks)
    ? blocks.map((b) => b?.text ?? "").join("")
    : "";
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
  if (!body.cv) {
    return NextResponse.json(fail(provider, "Missing CV data."), { status: 400 });
  }
  if (!(body.jobDescription ?? "").trim()) {
    return NextResponse.json(fail(provider, "Paste a job description to refine against."), { status: 400 });
  }

  const system = SYSTEM_PROMPT;
  const user = buildUserPrompt(body.cv, body.jobDescription!);

  try {
    const out =
      provider === "openai"
        ? await callOpenAI(apiKey, model, system, user)
        : await callAnthropic(apiKey, model, system, user);

    if (!out.ok) {
      // Verbatim provider error body (req 12).
      return NextResponse.json(
        { ok: false, provider, model, error: { provider, status: out.status, message: out.body } } as RefineResponse,
        { status: 200 }
      );
    }
    return NextResponse.json({ ok: true, provider, model, raw: out.content } as RefineResponse, { status: 200 });
  } catch (e) {
    // Network / unexpected error — surface verbatim.
    return NextResponse.json(
      { ok: false, provider, model, error: { provider, message: (e as Error).message } } as RefineResponse,
      { status: 200 }
    );
  }
}
