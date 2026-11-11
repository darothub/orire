/**
 * orire — coach run gating, kept free of Next/Prisma so it can be unit-tested
 * with an in-memory store. The agents route wires it to the real entitlement
 * functions.
 *
 * Analyze starts a run: plan check, monthly cap check, one unit consumed, token
 * minted. Rewrite/critique must present that token and each claim one of the
 * run's bounded steps. Whatever was claimed can be undone if the step fails.
 */

import { allowCoach, withinCap, type PlanId } from "@/lib/plan/plan";
import { signCoachToken, verifyCoachToken } from "@/lib/plan/coachToken";

export interface CoachStore {
  getPlan(userId: string): Promise<PlanId>;
  getUsed(userId: string, plan: PlanId): Promise<number>;
  consume(userId: string, plan: PlanId): Promise<void>;
  refund(userId: string, plan: PlanId): Promise<void>;
  claimStep(userId: string, runId: string): Promise<boolean>;
  releaseStep(userId: string, runId: string): Promise<void>;
}

export type CoachGate =
  | { ok: true; runToken?: string; undo: () => Promise<void> }
  | { ok: false; status: number; error: string };

export async function gateCoachCall(
  userId: string,
  action: "analyze" | "rewrite" | "critique",
  runToken: unknown,
  store: CoachStore,
): Promise<CoachGate> {
  const plan = await store.getPlan(userId);
  if (!allowCoach(plan)) {
    return { ok: false, status: 402, error: "The CV coach is a Pro feature. Upgrade your plan to use it." };
  }

  if (action === "analyze") {
    const cap = withinCap(plan, "coach", await store.getUsed(userId, plan));
    if (!cap.allowed) return { ok: false, status: 402, error: cap.reason ?? "Monthly coach limit reached." };
    await store.consume(userId, plan);
    return {
      ok: true,
      runToken: signCoachToken(userId).token,
      undo: () => store.refund(userId, plan),
    };
  }

  const t = verifyCoachToken(runToken, userId);
  if (!t.ok) return { ok: false, status: 403, error: t.reason };
  if (!(await store.claimStep(userId, t.runId))) {
    return { ok: false, status: 429, error: "This coach run has used all its steps. Start over to run it again." };
  }
  return { ok: true, undo: () => store.releaseStep(userId, t.runId) };
}
