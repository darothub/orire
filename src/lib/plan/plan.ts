/**
 * orire — subscription plan policy.
 *
 * orire runs on its own managed provider keys, so "plans" gate both PRODUCT
 * capability (how many assistants run at once, refines per month) and our token
 * spend (which model tiers an account may run on our dime). Premium models are
 * the expensive ones, so only the top plan includes them.
 *
 * This module is pure/deterministic and unit-tested; enforcement lives in the
 * refine route + UI, which read these entitlements.
 */

import type { ProviderId } from "@/lib/ai/types";

export type PlanId = "free" | "pro" | "career";

/** A metered action — one unit of spend/quota on orire's managed keys. */
export type Metric = "refine" | "simulate" | "download";

/**
 * How a metric is capped for a plan.
 * - `scope: "lifetime"` — the cap is a lifetime total that never resets
 *   (the whole point of the Free tier; survives cache-clear / CV deletion).
 * - `scope: "monthly"` — the cap refreshes each calendar month (Pro refine).
 * - `cap: null` — unlimited; the action is not metered at all.
 */
export interface MeterRule {
  cap: number | null;
  scope: "lifetime" | "monthly";
}

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
  /** Model tiers this plan may run (on orire's managed keys). */
  includedTiers: ModelTier[];
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
    includedTiers: ["budget"],
    perks: ["All 25 templates", "3 AI refines to try it", "Single assistant", "Clean PDF export"],
  },
  pro: {
    id: "pro",
    label: "Pro",
    price: 9,
    blurb: "For an active job hunt.",
    maxProviders: 2,
    allowCompare: true,
    includedTiers: ["budget", "mid"],
    perks: ["All 25 templates", "30 refines / mo", "Compare 2 + judge", "Cover letters", "Clean PDF, all page modes"],
  },
  career: {
    id: "career",
    label: "Career",
    price: 19,
    blurb: "For power switchers.",
    maxProviders: 3,
    allowCompare: true,
    includedTiers: ["budget", "mid", "premium"],
    perks: ["Unlimited refines (fair-use)", "Premium models included", "Parallel compare + judge", "JD simulation", "Company history"],
  },
};

/**
 * Per-(plan, metric) usage rules — the single source of truth for every cap.
 *
 * Free is capped lifetime (never resets) on all three actions. Pro keeps a
 * monthly refine cap (cost control on managed keys) but is otherwise unlimited.
 * Career is unlimited across the board. A `null` cap means the action is not
 * metered for that plan.
 */
export const PLAN_METERS: Record<PlanId, Record<Metric, MeterRule>> = {
  free: {
    refine: { cap: 3, scope: "lifetime" },
    simulate: { cap: 1, scope: "lifetime" },
    download: { cap: 3, scope: "lifetime" },
  },
  pro: {
    refine: { cap: 30, scope: "monthly" },
    simulate: { cap: null, scope: "lifetime" },
    download: { cap: null, scope: "lifetime" },
  },
  career: {
    refine: { cap: null, scope: "lifetime" },
    simulate: { cap: null, scope: "lifetime" },
    download: { cap: null, scope: "lifetime" },
  },
};

/** The usage rule for a plan + metric. */
export function meterFor(planId: PlanId, metric: Metric): MeterRule {
  return PLAN_METERS[planId][metric];
}

/** Convenience: the refine cap for a plan (null = unlimited). */
export function refineCap(planId: PlanId): number | null {
  return PLAN_METERS[planId].refine.cap;
}

export const PLAN_ORDER: PlanId[] = ["free", "pro", "career"];

/**
 * User-facing quality label for the assistants a plan runs. We deliberately
 * hide raw model names/pickers — users pick an assistant and a plan, and the
 * plan determines the quality tier orire runs it at (on managed keys).
 */
export function planQualityLabel(planId: PlanId): string {
  const tiers = PLANS[planId].includedTiers;
  if (tiers.includes("premium")) return "Premium quality";
  if (tiers.includes("mid")) return "Advanced quality";
  return "Standard quality";
}

/** Model-name fragments that indicate a premium (large/expensive) model. */
const PREMIUM_PATTERNS = [/opus/i, /gpt-4(?:\.\d+)?$/i, /gpt-4-turbo/i, /\bo3\b/i, /o1(?:-preview)?/i];
/** Fragments that indicate a budget (small/cheap) model. */
const BUDGET_PATTERNS = [/mini/i, /nano/i, /haiku/i, /flash/i, /small/i, /-lite/i];

/**
 * Classify a model into a cost tier. An empty model string defaults to "mid"
 * so it is never blocked as "premium" by accident.
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
 * Whether a given provider+model may run on `plan`. A model is allowed iff its
 * cost tier is included in the plan (orire runs it on its own managed keys).
 */
export function modelAllowedOnPlan(
  planId: PlanId,
  provider: ProviderId,
  model: string
): ModelAllowance {
  const plan = PLANS[planId];
  const tier = modelTier(provider, model);
  if (plan.includedTiers.includes(tier)) return { allowed: true, tier };
  const reason =
    tier === "premium"
      ? `${plan.label} doesn’t include premium models like “${model}”. Upgrade to Career to run them.`
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

/**
 * Which assistants a plan may run. Free is OpenAI (ChatGPT) only — Claude
 * (Anthropic) is a Pro feature, so a free user is nudged to upgrade to compare
 * with Claude. Pro and Career can run either assistant.
 */
export function providerAllowedOnPlan(planId: PlanId, provider: ProviderId): RunAllowance {
  if (planId === "free" && provider === "anthropic") {
    return {
      allowed: false,
      reason: "Claude (Anthropic) is a Pro feature. Upgrade to Pro to compare with Claude.",
    };
  }
  return { allowed: true };
}

/** Plain-language plural for a metric, used in cap/upsell copy. */
function metricNoun(metric: Metric): string {
  return metric === "refine" ? "refines" : metric === "simulate" ? "simulations" : "downloads";
}

/**
 * Whether another unit of `metric` is within the plan's cap, given how many are
 * already used in the active period. Unlimited (cap null) is always allowed.
 * The reason copy adapts to the scope ("…this month" for monthly caps).
 */
export function withinCap(planId: PlanId, metric: Metric, used: number): RunAllowance {
  const { cap, scope } = meterFor(planId, metric);
  if (cap === null) return { allowed: true };
  if (used >= cap) {
    const next = nextPlan(planId);
    const upsell = next ? `Upgrade to ${next.label} for more.` : "Upgrade for more.";
    const when = scope === "monthly" ? " this month" : "";
    return {
      allowed: false,
      reason: `You’ve used all ${cap} ${metricNoun(metric)}${when} on ${PLANS[planId].label}. ${upsell}`,
    };
  }
  return { allowed: true };
}

/** The next plan up, for upsell copy. */
export function nextPlan(planId: PlanId): Plan | null {
  const i = PLAN_ORDER.indexOf(planId);
  return i >= 0 && i < PLAN_ORDER.length - 1 ? PLANS[PLAN_ORDER[i + 1]] : null;
}

/**
 * Whether the (optional) cover-letter companion is available on a plan.
 * Cover letters are a paid add-on: every plan except Free includes them.
 */
export function allowCoverLetter(planId: PlanId): boolean {
  return planId !== "free";
}
