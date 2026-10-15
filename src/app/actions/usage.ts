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
  return getUsageSummary(userId);
}
