/**
 * orire — health / readiness endpoint.
 *
 * GET /api/health → liveness + readiness snapshot for uptime monitors and
 * platform health checks. Returns 200 when the database is reachable (even if
 * optional integrations are degraded), 503 when it is not. The check logic
 * lives in `runHealthChecks` so it stays unit-testable.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { runHealthChecks } from "@/lib/obs/health";
import { logger } from "@/lib/obs/logger";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";
import { providerConfigured } from "@/lib/ai/server/serverKey";
import { isStripeConfigured } from "@/lib/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await runHealthChecks({
    pingDb: async () => {
      const started = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      return Date.now() - started;
    },
    providersConfigured: () =>
      (Object.keys(PROVIDERS) as ProviderId[]).filter((p) => providerConfigured(p)),
    stripeConfigured: isStripeConfigured,
  });

  if (!result.ok) {
    logger.error("health.down", { error: result.checks.db.error });
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
