/**
 * orire — usage read action.
 *
 * Exposes the signed-in user's per-metric usage (refine / simulate / download)
 * to the client so it can show "N free … left" alerts and, later, grey out an
 * exhausted feature. Read-only: enforcement happens in the authorize action and
 * the AI routes; this is purely for display. Returns null when signed out.
 */

"use server";

import { auth } from "@/lib/auth/auth";
import { getUsageSummary, type UsageSummary } from "@/lib/entitlement/entitlement";

export async function readUsage(): Promise<UsageSummary | null> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return null;
  // Hermetic Playwright: no entitlement row — career-unlimited snapshot.
  const { isE2eBypassUser } = await import("@/lib/e2e/bypass");
  if (isE2eBypassUser(userId)) {
    return {
      plan: "career",
      metrics: {
        refine: { used: 0, cap: null, remaining: null, scope: "monthly" },
        simulate: { used: 0, cap: null, remaining: null, scope: "monthly" },
        download: { used: 0, cap: null, remaining: null, scope: "monthly" },
      },
    };
  }
  try {
    return await getUsageSummary(userId);
  } catch {
    // Keep the ambient mirror null rather than crashing the client when DB is down.
    return null;
  }
}
