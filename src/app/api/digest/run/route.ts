/**
 * orire — scheduled team usage digest runner.
 *
 * A scheduler (cron, GitHub Action, platform scheduler) POSTs here monthly to
 * fan the usage digest out to every team's owner/admins. Guarded by a shared
 * secret in `DIGEST_CRON_SECRET`: the caller must present it as either a
 * `Bearer` Authorization header or `?secret=`. When the secret is unset the
 * endpoint is disabled (503) so it can never run unauthenticated in prod.
 *
 * Optional `?window=3|6|12` selects the trailing window length.
 */

import { NextResponse } from "next/server";
import { runAllTeamDigests } from "@/lib/team/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.DIGEST_CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

async function run(req: Request): Promise<Response> {
  if (!process.env.DIGEST_CRON_SECRET) {
    return NextResponse.json({ error: "Digest runner disabled." }, { status: 503 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const windowParam = Number(new URL(req.url).searchParams.get("window"));
  const summary = await runAllTeamDigests(
    Number.isFinite(windowParam) && windowParam > 0 ? windowParam : undefined,
  );
  return NextResponse.json({
    teams: summary.teams,
    sent: summary.sent,
    failed: summary.failed,
  });
}

export async function POST(req: Request): Promise<Response> {
  return run(req);
}

export async function GET(req: Request): Promise<Response> {
  return run(req);
}
