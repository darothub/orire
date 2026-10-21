/**
 * orire — activation-nudge cron (P1-12).
 *
 * Runs once daily (see vercel.json) — deliberately NOT hourly: Vercel's
 * Hobby plan only allows once-per-day cron schedules (more frequent
 * expressions fail at deploy time), and this repo shouldn't assume a Pro
 * plan. A daily cadence still never misses anyone: the window below spans a
 * full 24h (signup 24–48h ago), so two consecutive daily runs always overlap
 * by at least that much, even with Vercel's documented up-to-59-minute
 * scheduling slop on Hobby. If this project is on Pro and wants tighter
 * latency, the schedule can be safely tightened (e.g. every 6h) without
 * touching this logic.
 *
 * Finds verified users who signed up 24–48h ago, checks two "ever activated"
 * signals (ExportEvent for exports; UsageCounter(metric="simulate",
 * period="lifetime") for Simulate — both already-tracked tables, nothing new
 * to log there), and sends a single nudge email tailored to whichever gap(s)
 * remain. A user who's done both gets nothing; a user already sent the
 * nudge (LifecycleEmail claim) gets nothing on a later sweep either.
 *
 * Protected by CRON_SECRET: Vercel's own Cron Jobs send
 * `Authorization: Bearer ${CRON_SECRET}` automatically when that env var is
 * set (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
 * With no CRON_SECRET configured, the route refuses every request — fail
 * closed, since this sends real mail and reads account creation timestamps.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { pickActivationGap } from "@/lib/lifecycle/activation";
import { claimLifecycleEmail, releaseLifecycleEmail } from "@/lib/lifecycle/lifecycleEmailDedupe";
import { activationNudgeEmail } from "@/lib/email/templates";
import { sendMail } from "@/lib/email/mailer";
import { logger } from "@/lib/obs/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NUDGE_KIND = "activation_24h";
const WINDOW_MIN_HOURS = 24;
const WINDOW_MAX_HOURS = 48;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const windowStart = new Date(now - WINDOW_MAX_HOURS * 60 * 60 * 1000);
  const windowEnd = new Date(now - WINDOW_MIN_HOURS * 60 * 60 * 1000);

  const candidates = await prisma.user.findMany({
    where: {
      email: { not: null },
      emailVerified: { not: null },
      createdAt: { gte: windowStart, lte: windowEnd },
    },
    select: { id: true, email: true },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of candidates) {
    if (!user.email) continue;
    try {
      const [exportCount, simCounter] = await Promise.all([
        prisma.exportEvent.count({ where: { userId: user.id } }),
        prisma.usageCounter.findUnique({
          where: { userId_metric_period: { userId: user.id, metric: "simulate", period: "lifetime" } },
          select: { count: true },
        }),
      ]);

      const gap = pickActivationGap({
        exported: exportCount > 0,
        simulated: (simCounter?.count ?? 0) > 0,
      });
      if (gap === null) {
        skipped += 1;
        continue;
      }

      const claim = await claimLifecycleEmail(user.id, NUDGE_KIND);
      if (!claim.claimed) {
        skipped += 1;
        continue;
      }

      try {
        const { subject, html, text } = activationNudgeEmail(gap);
        await sendMail({ to: user.email, subject, html, text });
        sent += 1;
      } catch (err) {
        await releaseLifecycleEmail(user.id, NUDGE_KIND);
        throw err;
      }
    } catch (err) {
      failed += 1;
      logger.error("lifecycle.activation_nudge.failed", {
        userId: user.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("lifecycle.activation_nudge.swept", {
    candidates: candidates.length,
    sent,
    skipped,
    failed,
  });

  return NextResponse.json({ candidates: candidates.length, sent, skipped, failed });
}
