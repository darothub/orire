/**
 * orire — server-authoritative entitlements & usage (Phase B1).
 *
 * The client `planStore` used to be the sole source of truth for a user's plan
 * and monthly refine count, which meant devtools could unlock paid capability.
 * These helpers move that truth into Postgres:
 *
 *   - Entitlement.plan              → the user's plan (defaults to "free")
 *   - UsageCounter (metric, period) → the enforceable usage count per action,
 *     where period is "lifetime" (Free) or "YYYY-MM" (Pro refine)
 *
 * Consumption is atomic: `consume` upserts + increments in one round-trip so
 * concurrent runs can't slip past the cap.
 */

import { prisma } from "@/lib/db/prisma";
import type { PlanId, Metric } from "@/lib/plan/plan";
import { meterFor, refineCap } from "@/lib/plan/plan";

const PLAN_IDS = new Set<string>(["free", "pro", "career"]);

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

/**
 * The storage period for a (plan, metric): the current month for monthly-scoped
 * caps (e.g. Pro refine), else the constant "lifetime" for never-resetting caps.
 * This is what makes a lifetime cap survive forever and a monthly cap refresh.
 */
export function periodFor(plan: PlanId, metric: Metric, now: Date = new Date()): string {
  return meterFor(plan, metric).scope === "monthly" ? currentMonth(now) : "lifetime";
}

/** Read how many of `metric` the user has used in the plan's active period. */
export async function getUsed(userId: string, metric: Metric, plan: PlanId): Promise<number> {
  const period = periodFor(plan, metric);
  const row = await prisma.usageCounter.findUnique({
    where: { userId_metric_period: { userId, metric, period } },
  });
  return row?.count ?? 0;
}

/**
 * Atomically consume one unit of `metric` in the plan's active period and
 * return the new count. The upsert makes the first use create the row, so
 * concurrent runs can't slip past the cap.
 */
export async function consume(userId: string, metric: Metric, plan: PlanId): Promise<number> {
  const period = periodFor(plan, metric);
  const row = await prisma.usageCounter.upsert({
    where: { userId_metric_period: { userId, metric, period } },
    create: { userId, metric, period, count: 1 },
    update: { count: { increment: 1 } },
  });
  return row.count;
}

/** Refund one unit of `metric` (floors at 0). For when a metered run fails. */
export async function refund(userId: string, metric: Metric, plan: PlanId): Promise<void> {
  const period = periodFor(plan, metric);
  const row = await prisma.usageCounter.findUnique({
    where: { userId_metric_period: { userId, metric, period } },
  });
  if (row && row.count > 0) {
    await prisma.usageCounter.update({
      where: { userId_metric_period: { userId, metric, period } },
      data: { count: { decrement: 1 } },
    });
  }
}

/**
 * Refine-shaped entitlement summary, kept for the client mirror / profile which
 * currently surface the refine counter. (E2 widens this to all metrics.)
 */
export interface EntitlementSummary {
  plan: PlanId;
  usedThisMonth: number;
  cap: number | null;
}

export async function getEntitlementSummary(userId: string): Promise<EntitlementSummary> {
  const plan = await getPlanId(userId);
  const usedThisMonth = await getUsed(userId, "refine", plan);
  return { plan, usedThisMonth, cap: refineCap(plan) };
}

/** Usage for one metric: how many used, the cap, and what's left. */
export interface MetricUsage {
  used: number;
  cap: number | null;
  /** cap - used, floored at 0; null when unlimited. */
  remaining: number | null;
  scope: "lifetime" | "monthly";
}

/** Per-metric usage snapshot for the signed-in user — drives the UI's
 *  remaining-count alerts (E2) and grey-out (E3). */
export interface UsageSummary {
  plan: PlanId;
  metrics: Record<Metric, MetricUsage>;
}

const METRICS: Metric[] = ["refine", "simulate", "download"];

export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const plan = await getPlanId(userId);
  const entries = await Promise.all(
    METRICS.map(async (metric) => {
      const rule = meterFor(plan, metric);
      const used = await getUsed(userId, metric, plan);
      const remaining = rule.cap === null ? null : Math.max(0, rule.cap - used);
      return [metric, { used, cap: rule.cap, remaining, scope: rule.scope }] as const;
    }),
  );
  return { plan, metrics: Object.fromEntries(entries) as Record<Metric, MetricUsage> };
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
