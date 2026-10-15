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
import { devLoginEnabled } from "@/lib/dev/devAccess";
import type { ProviderId } from "@/lib/ai/types";
import type { PlanId } from "@/lib/plan/plan";
import {
  providerCountAllowed,
  withinCap,
  providerAllowedOnPlan,
  refineCap,
} from "@/lib/plan/plan";
import {
  consume,
  getEntitlementSummary,
  getPlanId,
  getUsed,
  setPlanId,
} from "@/lib/entitlement/entitlement";
import { signRunToken } from "@/lib/plan/runToken";
import { isEmailVerified } from "@/lib/auth/verify";

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
  const usedThisMonth = userId ? await getUsed(userId, "refine", plan) : 0;
  const cap = refineCap(plan);

  const providers = selections.map((s) => s.provider);
  const blocked = (title: string, body: string): AuthorizeResult => ({
    ok: false,
    signedIn,
    plan,
    usedThisMonth,
    cap,
    block: { title, body },
  });

  // Email-verification gate: an unverified account cannot spend the free quota.
  // This is what stops throwaway accounts from resetting the free count.
  if (userId && !(await isEmailVerified(userId))) {
    return blocked(
      "Verify your email",
      "Check your inbox for the verification link we sent, then run again. You can resend it from your account menu.",
    );
  }

  if (providers.length === 0) {
    return blocked("Nothing selected", "Pick at least one assistant to run.");
  }

  const countGate = providerCountAllowed(plan, providers.length);
  if (!countGate.allowed) {
    return blocked("Plan limit", countGate.reason ?? "Not allowed on your plan.");
  }

  // Provider gate: Free is OpenAI-only; Claude (Anthropic) needs Pro.
  for (const p of providers) {
    const provGate = providerAllowedOnPlan(plan, p);
    if (!provGate.allowed) {
      return blocked("Upgrade to compare with Claude", provGate.reason ?? "That assistant isn't on your plan.");
    }
  }

  const capGate = withinCap(plan, "refine", usedThisMonth);
  if (!capGate.allowed) {
    return blocked("Refine limit reached", capGate.reason ?? "Upgrade for more refines.");
  }

  // Consume one refine (signed-in users only, and only when the plan meters
  // refines — unlimited plans aren't counted) then mint the run token.
  let newUsed = usedThisMonth;
  if (userId && cap !== null) {
    newUsed = await consume(userId, "refine", plan);
  }

  const token = signRunToken({ userId, plan, providers });
  return { ok: true, token, signedIn, plan, usedThisMonth: newUsed, cap };
}

/** Read the signed-in user's server-truth plan + usage (client mirror source). */
export async function readEntitlement(): Promise<AuthorizeResult | null> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return null;
  const plan = await getPlanId(userId);
  const usedThisMonth = await getUsed(userId, "refine", plan);
  return {
    ok: true,
    signedIn: true,
    plan,
    usedThisMonth,
    cap: refineCap(plan),
  };
}

/**
 * Dev-only plan switch until Stripe (B2) owns entitlement. Lets a signed-in
 * user move between plans locally so the gate can be exercised end-to-end.
 */
export async function devSetPlan(plan: PlanId): Promise<AuthorizeResult | null> {
  // Hard no-op in production: this dev-only plan switch must never grant paid
  // entitlement to a real user. devLoginEnabled() is false when NODE_ENV=production.
  if (!devLoginEnabled()) return null;
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
