import "server-only";
import { claimCoachStep, consume, getPlanId, getUsed, refund, releaseCoachStep } from "@/lib/entitlement/entitlement";
import type { CoachStore } from "@/lib/plan/coachGate";

/** The real, database-backed coach store. Shared by every route that spends a coach run. */
export const coachStore: CoachStore = {
  getPlan: getPlanId,
  getUsed: (u, plan) => getUsed(u, "coach", plan),
  consume: async (u, plan) => void (await consume(u, "coach", plan)),
  refund: (u, plan) => refund(u, "coach", plan),
  claimStep: claimCoachStep,
  releaseStep: releaseCoachStep,
};
