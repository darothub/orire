/**
 * orire — subscription plan policy (client-side, BYO-key model).
 *
 * orire runs on the user's own provider keys/CLI logins, so "plans" here gate
 * PRODUCT capability, not our token spend: how many assistants can run at once
 * (single vs parallel compare), how many refines per month, and which model
 * tiers are usable without bringing your own key. The economics behind these
 * limits are pressure-tested in the pricing model — premium models are the
 * expensive ones, so on cheaper plans they require a BYO key.
 *
 * This module is pure/deterministic and unit-tested; enforcement lives in the
 * refine store + UI, which read these entitlements.
 */

import type { ProviderId } from "@/lib/ai/types";

export type PlanId = "free" | "pro" | "career" | "teams";

/** Rough cost/quality tier of a model, used to gate premium usage per plan. */
export type ModelTier = "budget" | "mid" | "premium";

export interface Plan {
  id: PlanId;
  label: string;
  /** Monthly price in USD (annual/one-off handled elsewhere). */
  price: number;
  blurb: string;
  /** Max assistants selectable for a single run (2 = parallel compare). */
  maxProviders: number;
  /** Whether the LLM-judge compare flow is available at all. */
  allowCompare: boolean;
  /** Monthly refine/compare runs; null = effectively unlimited (fair-use). */
  monthlyRefines: number | null;
  /** Model tiers usable WITHOUT a BYO key on this plan. */
  includedTiers: ModelTier[];
  /** When true, premium-tier models are allowed only via a BYO key/CLI login. */
  premiumRequiresKey: boolean;
  /** Headline entitlements for the plan card. */
  perks: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    label: "Free",
    price: 0,
    blurb: "Try the rebrand + a taste of matching.",
    maxProviders: 1,
    allowCompare: false,
    monthlyRefines: 3,
    includedTiers: ["budget"],
    premiumRequiresKey: true,
    perks: ["5 templates", "3 JD refines / mo", "Single assistant", "Watermarked export"],
  },
  pro: {
    id: "pro",
    label: "Pro",
    price: 12,
    blurb: "For an active job hunt.",
    maxProviders: 2,
    allowCompare: true,
    monthlyRefines: 30,
    includedTiers: ["budget", "mid"],
    premiumRequiresKey: true,
    perks: ["All 25 templates", "30 refines / mo", "Compare 2 + judge", "Clean PDF, all page modes", "BYO key unlocks premium"],
  },
  career: {
    id: "career",
    label: "Career",
    price: 29,
    blurb: "For power switchers.",
    maxProviders: 3,
    allowCompare: true,
    monthlyRefines: null,
    includedTiers: ["budget", "mid"],
    premiumRequiresKey: true,
    perks: ["Unlimited refines (fair-use)", "Parallel compare + judge", "JD simulation", "DOCX + company history", "BYO key unlocks premium"],
  },
  teams: {
    id: "teams",
    label: "Teams / Coach",
    price: 99,
    blurb: "For coaches, bootcamps, agencies.",
    maxProviders: 4,
    allowCompare: true,
    monthlyRefines: null,
    includedTiers: ["budget", "mid", "premium"],
    premiumRequiresKey: false,
    perks: ["5 seats", "Pooled keys", "Branded templates", "Bulk export", "All model tiers"],
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "pro", "career", "teams"];

/** Model-name fragments that indicate a premium (large/expensive) model. */
const PREMIUM_PATTERNS = [/opus/i, /gpt-4(?:\.\d+)?$/i, /gpt-4-turbo/i, /\bo3\b/i, /o1(?:-preview)?/i];
/** Fragments that indicate a budget (small/cheap) model. */
const BUDGET_PATTERNS = [/mini/i, /nano/i, /haiku/i, /flash/i, /small/i, /-lite/i];

/**
 * Classify a model into a cost tier. CLI providers that expose no explicit
 * model (empty string) default to "mid" — the assistant picks its own model and
 * cost is the user's own login, so it is never blocked as "premium on our dime".
 */
export function modelTier(provider: ProviderId, model: string): ModelTier {
  const m = (model ?? "").trim();
  if (!m) return "mid";
  if (BUDGET_PATTERNS.some((r) => r.test(m))) return "budget";
  if (PREMIUM_PATTERNS.some((r) => r.test(m))) return "premium";
  return "mid";
}

export interface ModelAllowance {
  allowed: boolean;
  tier: ModelTier;
  /** Present when blocked — a short, user-facing reason. */
  reason?: string;
}

/**
 * Whether a given provider+model may run on `plan`, considering whether the
 * user has supplied their own key/CLI login (`hasOwnKey`). Premium models on
 * key-gated plans are allowed ONLY when the user brings their own key.
 */
export function modelAllowedOnPlan(
  planId: PlanId,
  provider: ProviderId,
  model: string,
  hasOwnKey: boolean
): ModelAllowance {
  const plan = PLANS[planId];
  const tier = modelTier(provider, model);
  if (plan.includedTiers.includes(tier)) return { allowed: true, tier };
  if (tier === "premium" && plan.premiumRequiresKey && hasOwnKey) {
    return { allowed: true, tier };
  }
  const reason =
    tier === "premium"
      ? `${plan.label} needs your own API key to run premium models like “${model}”.`
      : `${plan.label} doesn’t include ${tier}-tier models.`;
  return { allowed: false, tier, reason };
}

export interface RunAllowance {
  allowed: boolean;
  reason?: string;
}

/** Whether the number of selected assistants is permitted by the plan. */
export function providerCountAllowed(planId: PlanId, count: number): RunAllowance {
  const plan = PLANS[planId];
  if (count > 1 && !plan.allowCompare) {
    return { allowed: false, reason: `Comparing assistants is a Pro feature. Upgrade to run 2 in parallel.` };
  }
  if (count > plan.maxProviders) {
    return { allowed: false, reason: `${plan.label} allows up to ${plan.maxProviders} assistant${plan.maxProviders > 1 ? "s" : ""} per run.` };
  }
  return { allowed: true };
}

/** Whether another refine run is within the monthly cap. */
export function withinMonthlyCap(planId: PlanId, usedThisMonth: number): RunAllowance {
  const cap = PLANS[planId].monthlyRefines;
  if (cap === null) return { allowed: true };
  if (usedThisMonth >= cap) {
    return { allowed: false, reason: `You’ve used all ${cap} refines on ${PLANS[planId].label} this month. Upgrade for more.` };
  }
  return { allowed: true };
}

/** The next plan up, for upsell copy. */
export function nextPlan(planId: PlanId): Plan | null {
  const i = PLAN_ORDER.indexOf(planId);
  return i >= 0 && i < PLAN_ORDER.length - 1 ? PLANS[PLAN_ORDER[i + 1]] : null;
}
