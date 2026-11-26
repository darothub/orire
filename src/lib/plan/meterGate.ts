/**
 * Metered AI calls, kept free of Next/Prisma so it can be unit-tested with an
 * in-memory store. One unit is claimed before the model runs, so concurrent
 * requests cannot pass the cap, and given back if the call fails. The cap for each
 * plan comes from PLAN_METERS.
 */

import { withinCap, type Metric, type PlanId } from "@/lib/plan/plan";

export interface MeterStore {
  getPlan(userId: string): Promise<PlanId>;
  /** Atomically add one unit and return the new count. */
  consume(userId: string, plan: PlanId): Promise<number>;
  refund(userId: string, plan: PlanId): Promise<void>;
}

export type MeterGate =
  | { ok: true; undo: () => Promise<void> }
  | { ok: false; status: 402; error: string };

export async function gateMeter(userId: string, metric: Metric, store: MeterStore): Promise<MeterGate> {
  const plan = await store.getPlan(userId);
  const count = await store.consume(userId, plan);
  const allowance = withinCap(plan, metric, count - 1);
  if (!allowance.allowed) {
    await store.refund(userId, plan);
    return { ok: false, status: 402, error: allowance.reason ?? "You've reached your plan's limit." };
  }
  return { ok: true, undo: () => store.refund(userId, plan) };
}
