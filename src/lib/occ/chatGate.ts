/**
 * Copilot chat reply gating, kept free of Next/Prisma so it can be unit-tested with
 * an in-memory store. Every plan may chat; each plan has its own reply allowance
 * (PLAN_METERS.chat). One unit is claimed before the model runs, so concurrent
 * messages cannot pass the cap, and given back if the reply fails.
 */

import { withinCap, type PlanId } from "@/lib/plan/plan";

export interface ChatStore {
  getPlan(userId: string): Promise<PlanId>;
  /** Atomically add one reply and return the new count. */
  consume(userId: string, plan: PlanId): Promise<number>;
  refund(userId: string, plan: PlanId): Promise<void>;
}

export type ChatGate =
  | { ok: true; undo: () => Promise<void> }
  | { ok: false; status: 402; error: string };

export async function gateChatReply(userId: string, store: ChatStore): Promise<ChatGate> {
  const plan = await store.getPlan(userId);
  const count = await store.consume(userId, plan);
  const allowance = withinCap(plan, "chat", count - 1);
  if (!allowance.allowed) {
    await store.refund(userId, plan);
    return { ok: false, status: 402, error: allowance.reason ?? "You've used all your Copilot replies." };
  }
  return { ok: true, undo: () => store.refund(userId, plan) };
}
