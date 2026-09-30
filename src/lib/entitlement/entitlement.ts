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

/* ------------------------------------------------------------------ *
 * Stripe billing (Phase B2)
 *
 * The webhook is the source of truth for paid plans: Checkout and the
 * Customer Portal both fan out to subscription events, which call
 * `applyStripeSubscription` / `clearStripeSubscription` here. Checkout
 * itself only needs `linkStripeCustomer` so the customer id is on the row
 * before the first subscription event lands.
 * ------------------------------------------------------------------ */

/** The full entitlement row for a user (null when none exists yet). */
export async function getEntitlementRow(userId: string) {
  return prisma.entitlement.findUnique({ where: { userId } });
}

/** Find the user id that owns a Stripe customer (null when unlinked). */
export async function findUserIdByStripeCustomer(customerId: string): Promise<string | null> {
  const row = await prisma.entitlement.findUnique({ where: { stripeCustomerId: customerId } });
  return row?.userId ?? null;
}

/** Attach a Stripe customer id to a user's entitlement row (idempotent). */
export async function linkStripeCustomer(userId: string, customerId: string): Promise<void> {
  await prisma.entitlement.upsert({
    where: { userId },
    create: { userId, plan: "free", stripeCustomerId: customerId },
    update: { stripeCustomerId: customerId },
  });
}

export interface StripeSubscriptionState {
  plan: PlanId;
  status: string;
  stripeSubscriptionId: string;
  currentPeriodEnd: Date | null;
}

/**
 * Apply an active/updated Stripe subscription to the entitlement identified by
 * its Stripe customer id. No-ops (returns false) when the customer isn't linked
 * to a user — the webhook logs and acks so Stripe stops retrying.
 */
export async function applyStripeSubscription(
  customerId: string,
  state: StripeSubscriptionState,
): Promise<boolean> {
  const plan = PLAN_IDS.has(state.plan) ? state.plan : "free";
  const row = await prisma.entitlement.findUnique({ where: { stripeCustomerId: customerId } });
  if (!row) return false;
  await prisma.entitlement.update({
    where: { stripeCustomerId: customerId },
    data: {
      plan,
      status: state.status,
      stripeSubscriptionId: state.stripeSubscriptionId,
      currentPeriodEnd: state.currentPeriodEnd,
    },
  });
  return true;
}

/**
 * Downgrade the entitlement for a Stripe customer back to free (subscription
 * canceled/deleted). Keeps the customer id so a future resubscribe reuses it.
 */
export async function clearStripeSubscription(customerId: string, status = "canceled"): Promise<boolean> {
  const row = await prisma.entitlement.findUnique({ where: { stripeCustomerId: customerId } });
  if (!row) return false;
  await prisma.entitlement.update({
    where: { stripeCustomerId: customerId },
    data: { plan: "free", status, stripeSubscriptionId: null, currentPeriodEnd: null },
  });
  return true;
}
