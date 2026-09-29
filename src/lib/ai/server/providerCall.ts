/**
 * orire — server-side provider dispatch (Node runtime only).
 *
 * Single point where a system+user prompt is sent to a provider and a text
 * completion comes back. Two transports:
 *   - "api": HTTPS to OpenAI / Anthropic with the user's BYO key.
 *   - "cli": spawn the local Claude Code binary (`claude -p`), which uses the
 *     user's existing login — no API key handled by orire at all.
 *
 * Every failure path returns the provider's own message VERBATIM (req 12); we
 * never paraphrase provider or CLI errors. Importing `node:child_process` keeps
 * this module server-only (it can never be bundled into client code).
 */

import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";

export type ProviderCall =
  | { ok: true; content: string }
  | { ok: false; status?: number; body: string };

export interface CallOpts {
  temperature?: number;
  maxTokens?: number;
}

async function callOpenAI(
  key: string,
  model: string,
  system: string,
  user: string,
  opts: CallOpts
): Promise<ProviderCall> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: text };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, status: res.status, body: text };
  }
  const content: string =
    (data as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content ?? "";
  return { ok: true, content };
}

async function callAnthropic(
  key: string,
  model: string,
  system: string,
  user: string,
  opts: CallOpts
): Promise<ProviderCall> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 8000,
      temperature: opts.temperature ?? 0.2,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: text };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, status: res.status, body: text };
  }
  const blocks = (data as { content?: { text?: string }[] })?.content;
  const content: string = Array.isArray(blocks) ? blocks.map((b) => b?.text ?? "").join("") : "";
  return { ok: true, content };
}

const CLI_TIMEOUT_MS = 180_000;

/**
 * Run a one-shot Claude Code request. The user message is piped via stdin (never
 * interpolated into a shell string → no injection), the system prompt fully
 * overrides the default, and we run in a temp cwd so no project CLAUDE.md, hooks
 * or MCP config leak into the request.
 */
function callClaudeCLI(model: string, system: string, user: string): Promise<ProviderCall> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r: ProviderCall) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };

    const args = ["-p", "--output-format", "json", "--no-session-persistence"];
    if (system) args.push("--system-prompt", system);
    if (model) args.push("--model", model);

    const child = spawn("claude", args, {
      cwd: tmpdir(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      done({ ok: false, body: `Claude Code CLI timed out after ${CLI_TIMEOUT_MS / 1000}s.` });
    }, CLI_TIMEOUT_MS);

    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));

    child.on("error", (e) => {
      clearTimeout(timer);
      const msg =
        (e as NodeJS.ErrnoException).code === "ENOENT"
          ? "Claude Code CLI not found. Install it and make sure `claude` is on your PATH."
          : `Failed to launch Claude Code CLI: ${e.message}`;
      done({ ok: false, body: msg });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return done({
          ok: false,
          status: code ?? undefined,
          body: (err || out || `claude exited with code ${code}`).trim(),
        });
      }
      // --output-format json emits a single result envelope.
      try {
        const j = JSON.parse(out) as { result?: string; is_error?: boolean };
        if (j.is_error) return done({ ok: false, body: String(j.result ?? out).trim() });
        return done({ ok: true, content: String(j.result ?? "") });
      } catch {
        // Not JSON (older CLI / unexpected) — return raw text; guardrails will
        // still try to locate the embedded JSON object.
        return done({ ok: true, content: out.trim() });
      }
    });

    child.stdin.on("error", () => {
      /* ignore EPIPE if the child exits before reading stdin */
    });
    child.stdin.write(user);
    child.stdin.end();
  });
}

/** Dispatch a prompt to the given provider, regardless of transport. */
export async function runProvider(args: {
  provider: ProviderId;
  apiKey?: string;
  model: string;
  system: string;
  user: string;
  opts?: CallOpts;
}): Promise<ProviderCall> {
  const { provider, apiKey, model, system, user, opts = {} } = args;
  if (PROVIDERS[provider].kind === "cli") {
    return callClaudeCLI(model, system, user);
  }
  if (provider === "openai") return callOpenAI(apiKey ?? "", model, system, user, opts);
  return callAnthropic(apiKey ?? "", model, system, user, opts);
}
