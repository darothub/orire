/**
 * orire — landing pricing rows.
 *
 * The public pricing section must never drift from the real entitlement policy,
 * so its display rows are *derived* from `PLANS` (the single source of truth in
 * plan.ts) rather than hand-written. This module is a pure transform — display
 * concerns only (price formatting, the recommended highlight, CTA copy) — so it
 * is unit-testable in the node env with no DOM.
 */

import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/plan/plan";

export interface LandingPlan {
  id: PlanId;
  label: string;
  /** Formatted headline price, e.g. "Free" or "$12". */
  priceLabel: string;
  /** Billing cadence shown under the price. */
  cadence: string;
  blurb: string;
  perks: string[];
  /** The recommended plan is visually emphasised. */
  highlighted: boolean;
  /** Call-to-action copy for this card. */
  cta: string;
}

/** The plan we steer visitors toward (best value for an active job hunt). */
export const RECOMMENDED_PLAN: PlanId = "pro";

/** Build display-ready pricing rows from the canonical plan policy. */
export function landingPlans(): LandingPlan[] {
  return PLAN_ORDER.map((id) => {
    const plan = PLANS[id];
    const free = plan.price === 0;
    return {
      id,
      label: plan.label,
      priceLabel: free ? "Free" : `$${plan.price}`,
      cadence: free ? "forever" : "/ month",
      blurb: plan.blurb,
      perks: plan.perks,
      highlighted: id === RECOMMENDED_PLAN,
      cta: free ? "Start free" : `Choose ${plan.label}`,
    };
  });
}
