/**
 * orire — landing pricing rows.
 *
 * The public pricing section must never drift from the real entitlement policy,
 * so its display rows are *derived* from `PLANS` (the single source of truth in
 * plan.ts) rather than hand-written. This module is a pure transform — display
 * concerns only (price formatting, the recommended highlight, CTA copy) — so it
 * is unit-testable in the node env with no DOM.
 */

import { PLANS, PLAN_METERS, PLAN_ORDER, type PlanId, type MeterRule } from "@/lib/plan/plan";

export interface LandingPlan {
  id: PlanId;
  label: string;
  /** Formatted headline price, e.g. "Free" or "$12". */
  priceLabel: string;
  /** Billing cadence shown under the price. */
  cadence: string;
  blurb: string;
  perks: string[];
  usageDetails: string[];
  /** The recommended plan is visually emphasised. */
  highlighted: boolean;
  /** Call-to-action copy for this card. */
  cta: string;
}

/** The plan we steer visitors toward (best value for an active job hunt). */
export const RECOMMENDED_PLAN: PlanId = "pro";

/** Distinguish lifetime free quotas from recurring monthly allowances. */
function quotaText(action: string, meter: MeterRule): string {
  if (meter.cap === null) return action === "AI refinements" ? `${action}: unlimited (subject to fair use)` : `${action}: unlimited`;
  return `${action}: ${meter.cap} ${meter.scope === "monthly" ? "per month" : "total, lifetime"}`;
}

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
      usageDetails: [
        quotaText("AI refinements", PLAN_METERS[id].refine),
        quotaText("Job-match simulations", PLAN_METERS[id].simulate),
        quotaText("PDF / Word downloads", PLAN_METERS[id].download),
      ],
      highlighted: id === RECOMMENDED_PLAN,
      cta: free ? "Start free" : `Choose ${plan.label}`,
    };
  });
}
