/**
 * orire — CLI provider availability probe (Node runtime).
 *
 * Lets the UI tell the user whether a local CLI assistant (Claude Code, Codex)
 * is installed and reachable before they pick that connection. Runs the binary's
 * `--version` with a short timeout; never contacts a provider.
 *
 * GET /api/ai/cli?provider=<claude-cli|codex-cli>
 */

import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { PROVIDERS, isCLI, type ProviderId } from "@/lib/ai/types";

export const runtime = "nodejs";

export interface CliStatus {
  installed: boolean;
  version?: string;
  error?: string;
}

function probe(bin: string): Promise<CliStatus> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r: CliStatus) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    const child = spawn(bin, ["--version"], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      done({ installed: false, error: `Timed out probing \`${bin} --version\`.` });
    }, 8000);
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      const msg =
        (e as NodeJS.ErrnoException).code === "ENOENT"
          ? `\`${bin}\` not found on PATH.`
          : e.message;
      done({ installed: false, error: msg });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) return done({ installed: true, version: out.trim() || err.trim() || undefined });
      done({ installed: false, error: (err || out || `${bin} exited with code ${code}`).trim() });
    });
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const provider = (url.searchParams.get("provider") ?? "claude-cli") as ProviderId;
  if (!(provider in PROVIDERS) || !isCLI(provider)) {
    return NextResponse.json({ installed: false, error: "Not a CLI provider." } satisfies CliStatus, { status: 400 });
  }
  const bin = PROVIDERS[provider].cliBin ?? provider;
  const status = await probe(bin);
  return NextResponse.json(status);
}
