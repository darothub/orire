import "server-only";
import { consume, getPlanId, refund } from "@/lib/entitlement/entitlement";
import type { Metric } from "@/lib/plan/plan";
import type { MeterStore } from "@/lib/plan/meterGate";

/** The database-backed store for one metric. Shared by every route that spends it. */
export const meterStore = (metric: Metric): MeterStore => ({
  getPlan: getPlanId,
  consume: (userId, plan) => consume(userId, metric, plan),
  refund: (userId, plan) => refund(userId, metric, plan),
});
