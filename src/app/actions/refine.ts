/**
 * orire — refine authorization server action (Phase B1).
 *
 * This is the enforceable gate that the client must pass before the AI refine
 * proxy will run. It reads the caller's plan + usage from Postgres (NOT from
 * the client), applies the plan predicates, consumes one monthly refine, and
 * mints a short-lived signed run token that `/api/ai/refine` requires.
 *
 * Signed-in users are fully metered. Anonymous callers get a free-tier trial
 * token (single, non-premium — nothing paid to bypass) and are not metered,
 * since there is no durable identity to meter against.
 */

"use server";

import { auth } from "@/lib/auth/auth";
import type { ProviderId } from "@/lib/ai/types";
import type { PlanId } from "@/lib/plan/plan";
import {
  PLANS,
  providerCountAllowed,
  withinMonthlyCap,
} from "@/lib/plan/plan";
import {
  consumeMonthlyRefine,
  getEntitlementSummary,
  getPlanId,
  getUsedThisMonth,
  setPlanId,
} from "@/lib/entitlement/entitlement";
import { signRunToken } from "@/lib/plan/runToken";

export interface RunSelection {
  provider: ProviderId;
  model: string;
}

export interface AuthorizeResult {
  ok: boolean;
  token?: string;
  /** Whether the caller is signed in (client mirrors server truth only if so). */
  signedIn: boolean;
  /** Server-truth plan + usage so the client can reconcile its mirror. */
  plan: PlanId;
  usedThisMonth: number;
  cap: number | null;
  block?: { title: string; body: string };
}

/**
 * Validate a proposed refine run against the server's plan/usage truth and,
 * when allowed, consume one refine and return a run token. Per-model tier
 * enforcement happens in `/api/ai/refine` (driven by the plan in the token)
 * so one disallowed model fails only its own column, not the whole run.
 */
export async function authorizeRefineRun(selections: RunSelection[]): Promise<AuthorizeResult> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const signedIn = Boolean(userId);

  const plan: PlanId = userId ? await getPlanId(userId) : "free";
  const usedThisMonth = userId ? await getUsedThisMonth(userId) : 0;
  const cap = PLANS[plan].monthlyRefines;

  const providers = selections.map((s) => s.provider);
  const blocked = (title: string, body: string): AuthorizeResult => ({
    ok: false,
    signedIn,
    plan,
    usedThisMonth,
    cap,
    block: { title, body },
  });

  if (providers.length === 0) {
    return blocked("Nothing selected", "Pick at least one assistant to run.");
  }

  const countGate = providerCountAllowed(plan, providers.length);
  if (!countGate.allowed) {
    return blocked("Plan limit", countGate.reason ?? "Not allowed on your plan.");
  }

  const capGate = withinMonthlyCap(plan, usedThisMonth);
  if (!capGate.allowed) {
    return blocked("Monthly limit reached", capGate.reason ?? "Upgrade for more refines.");
  }

  // Consume one refine (signed-in users only) then mint the run token.
  let newUsed = usedThisMonth;
  if (userId) {
    newUsed = await consumeMonthlyRefine(userId);
  }

  const token = signRunToken({ userId, plan, providers });
  return { ok: true, token, signedIn, plan, usedThisMonth: newUsed, cap };
}

/** Read the signed-in user's server-truth plan + usage (client mirror source). */
export async function readEntitlement(): Promise<AuthorizeResult | null> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return null;
  const [plan, usedThisMonth] = await Promise.all([
    getPlanId(userId),
    getUsedThisMonth(userId),
  ]);
  return {
    ok: true,
    signedIn: true,
    plan,
    usedThisMonth,
    cap: PLANS[plan].monthlyRefines,
  };
}

/**
 * Dev-only plan switch until Stripe (B2) owns entitlement. Lets a signed-in
 * user move between plans locally so the gate can be exercised end-to-end.
 */
export async function devSetPlan(plan: PlanId): Promise<AuthorizeResult | null> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return null;
  await setPlanId(userId, plan);
  const summary = await getEntitlementSummary(userId);
  return {
    ok: true,
    signedIn: true,
    plan: summary.plan,
    usedThisMonth: summary.usedThisMonth,
    cap: summary.cap,
  };
}
