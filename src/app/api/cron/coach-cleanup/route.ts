/**
 * orire — coach step-counter cleanup cron.
 *
 * Each paid coach run leaves one small `coach-steps` UsageCounter row. Once the
 * run's token has expired the row can never matter again, so this daily job
 * (see vercel.json) deletes them. Protected by CRON_SECRET and fails closed
 * when it isn't configured, like the other cron routes.
 */

import { NextResponse } from "next/server";
import { purgeExpiredCoachSteps } from "@/lib/entitlement/entitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const deleted = await purgeExpiredCoachSteps();
  return NextResponse.json({ ok: true, deleted });
}
