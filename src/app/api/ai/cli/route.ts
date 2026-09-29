/**
 * orire — Claude Code CLI availability probe (Node runtime).
 *
 * Lets the UI tell the user whether the local `claude` binary is installed and
 * reachable before they pick the CLI connection. Runs `claude --version` with a
 * short timeout; never sends anything to a provider.
 */

import { NextResponse } from "next/server";
import { spawn } from "node:child_process";

export const runtime = "nodejs";

export interface CliStatus {
  installed: boolean;
  version?: string;
  error?: string;
}

function probe(): Promise<CliStatus> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r: CliStatus) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    const child = spawn("claude", ["--version"], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      done({ installed: false, error: "Timed out probing `claude --version`." });
    }, 8000);
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      const msg =
        (e as NodeJS.ErrnoException).code === "ENOENT"
          ? "`claude` not found on PATH."
          : e.message;
      done({ installed: false, error: msg });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) return done({ installed: true, version: out.trim() || undefined });
      done({ installed: false, error: (err || out || `claude exited with code ${code}`).trim() });
    });
  });
}

export async function GET() {
  const status = await probe();
  return NextResponse.json(status);
}
