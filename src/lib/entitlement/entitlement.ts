/**
 * orire — server-authoritative entitlements & usage (Phase B1).
 *
 * The client `planStore` used to be the sole source of truth for a user's plan
 * and monthly refine count, which meant devtools could unlock paid capability.
 * These helpers move that truth into Postgres:
 *
 *   - Entitlement.plan      → the user's plan (defaults to "free" when absent)
 *   - UsageCounter (month)  → the enforceable monthly refine count
 *
 * Consumption is atomic: `consumeMonthlyRefine` upserts + increments in one
 * round-trip so concurrent runs can't slip past the cap.
 */

import { prisma } from "@/lib/db/prisma";
import type { PlanId } from "@/lib/plan/plan";
import { PLANS } from "@/lib/plan/plan";

const PLAN_IDS = new Set<string>(["free", "pro", "career", "teams"]);

/** Current billing month key, "YYYY-MM" (UTC). */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Read a user's plan from Postgres, defaulting to "free" when no row exists. */
export async function getPlanId(userId: string): Promise<PlanId> {
  const ent = await prisma.entitlement.findUnique({ where: { userId } });
  const plan = ent?.plan ?? "free";
  return (PLAN_IDS.has(plan) ? plan : "free") as PlanId;
}

/** Read this month's refine count (0 when no counter row exists yet). */
export async function getUsedThisMonth(userId: string): Promise<number> {
  const row = await prisma.usageCounter.findUnique({
    where: { userId_month: { userId, month: currentMonth() } },
  });
  return row?.refinesUsed ?? 0;
}

export interface EntitlementSummary {
  plan: PlanId;
  usedThisMonth: number;
  cap: number | null;
}

export async function getEntitlementSummary(userId: string): Promise<EntitlementSummary> {
  const [plan, usedThisMonth] = await Promise.all([getPlanId(userId), getUsedThisMonth(userId)]);
  return { plan, usedThisMonth, cap: PLANS[plan].monthlyRefines };
}

/**
 * Atomically consume one refine for the current month and return the new count.
 * Uses an upsert so the first run of a month creates the row.
 */
export async function consumeMonthlyRefine(userId: string): Promise<number> {
  const month = currentMonth();
  const row = await prisma.usageCounter.upsert({
    where: { userId_month: { userId, month } },
    create: { userId, month, refinesUsed: 1 },
    update: { refinesUsed: { increment: 1 } },
  });
  return row.refinesUsed;
}

/** Refund one refine (e.g. when a run fails before any provider is called). */
export async function refundMonthlyRefine(userId: string): Promise<void> {
  const month = currentMonth();
  const row = await prisma.usageCounter.findUnique({
    where: { userId_month: { userId, month } },
  });
  if (row && row.refinesUsed > 0) {
    await prisma.usageCounter.update({
      where: { userId_month: { userId, month } },
      data: { refinesUsed: { decrement: 1 } },
    });
  }
}

/** Dev-only plan change (until Stripe/B2 owns this). Validates the plan id. */
export async function setPlanId(userId: string, plan: PlanId): Promise<void> {
  if (!PLAN_IDS.has(plan)) throw new Error(`Unknown plan: ${plan}`);
  await prisma.entitlement.upsert({
    where: { userId },
    create: { userId, plan },
    update: { plan },
  });
}
