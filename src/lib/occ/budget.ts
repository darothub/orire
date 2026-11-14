import "server-only";
import { prisma } from "@/lib/db/prisma";

// Conservative experimental budget, independent of existing plan quotas.
export const OCC_DAILY_AI_LIMIT = 20;
export function occBudgetPeriod(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function claimOccAiRequest(userId: string): Promise<boolean> {
  const period = occBudgetPeriod();
  const where = { userId_metric_period: { userId, metric: "occ-ai", period } };
  const counter = await prisma.usageCounter.upsert({
    where,
    create: { userId, metric: "occ-ai", period, count: 1 },
    update: { count: { increment: 1 } },
  });
  if (counter.count <= OCC_DAILY_AI_LIMIT) return true;
  await prisma.usageCounter.updateMany({
    where: { userId, metric: "occ-ai", period, count: { gt: 0 } },
    data: { count: { decrement: 1 } },
  });
  return false;
}

export async function refundOccAiRequest(userId: string): Promise<void> {
  await prisma.usageCounter.updateMany({
    where: { userId, metric: "occ-ai", period: occBudgetPeriod(), count: { gt: 0 } },
    data: { count: { decrement: 1 } },
  });
}
