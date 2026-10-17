/**
 * orire — plan-permitted managed failover for the user-selected refine route.
 *
 * Refine is different from the auto-routed tasks (see server/failover.ts): the
 * user *chooses* the assistant(s), and the choice is gated by a signed run
 * token. So we can't silently retry on any provider — a Free user may only use
 * OpenAI, and a 2-assistant compare already runs both. This helper computes the
 * one safe failover, which `authorizeRefineRun` bakes into the token so the hot
 * route can honour it without re-deriving plan truth:
 *
 *   - only for a SINGLE-provider run (a compare runs both already, so failing
 *     one over to the other would just duplicate a column);
 *   - the target is the OTHER managed provider on its managed budget model;
 *   - allowed only when the plan may use that provider AND that model tier.
 *
 * The managed defaults (gpt-5-mini / claude-haiku-4-5) are both budget-tier, so
 * the model gate passes on every plan — the real gate is provider-permission,
 * which correctly excludes Free (OpenAI-only) from failing over to Claude.
 */

import { otherProvider, MANAGED_MODEL } from "@/lib/ai/server/providerRouter";
import { providerAllowedOnPlan, modelAllowedOnPlan, type PlanId } from "@/lib/plan/plan";
import type { ProviderId } from "@/lib/ai/types";

export interface RefineFallback {
  provider: ProviderId;
  model: string;
}

/** The authorized failover for a refine run, or null when none applies. */
export function refineFallbackFor(plan: PlanId, providers: ProviderId[]): RefineFallback | null {
  if (providers.length !== 1) return null; // a compare already runs both assistants
  const to = otherProvider(providers[0]);
  if (providers.includes(to)) return null; // never duplicate a selected provider
  if (!providerAllowedOnPlan(plan, to).allowed) return null; // e.g. Free → Claude
  const model = MANAGED_MODEL[to];
  if (!modelAllowedOnPlan(plan, to, model).allowed) return null;
  return { provider: to, model };
}
