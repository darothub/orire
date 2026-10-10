/**
 * orire — account server actions.
 *
 * `deleteAccount` permanently removes the signed-in user and everything owned
 * by them. The Prisma schema cascades from `User` to documents, refine runs,
 * entitlement, usage counters, sessions, OAuth accounts and all single-use
 * tokens, so deleting the row is sufficient for the product data. Before that
 * we best-effort cancel any live Stripe subscription so we stop billing a
 * customer who is leaving.
 */

"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { cancelSubscriptionWithRetry, isStripeConfigured } from "@/lib/billing/stripe";
import { getEntitlementRow } from "@/lib/entitlement/entitlement";
import { logger } from "@/lib/obs/logger";

export interface DeleteAccountResult {
  ok?: true;
  error?: string;
}

/**
 * Permanently delete the signed-in user's account and all associated data.
 * Returns `{ ok: true }` on success; the caller is responsible for signing the
 * (now orphaned) session out afterwards.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return { error: "You’re not signed in." };

  // Refuse to silently destroy a shared Teams workspace — the owner must hand it
  // over or disband it first, otherwise other seated members would lose access.
  const sharedTeam = await prisma.team.findFirst({
    where: { ownerId: userId, members: { some: { userId: { not: userId } } } },
    select: { id: true },
  });
  if (sharedTeam) {
    return {
      error:
        "You own a team with other members. Transfer ownership or remove members before deleting your account.",
    };
  }

  // Cancel any active Stripe subscription so billing stops for a leaving
  // customer. We retry transient failures, but never block deletion — the
  // account must stay removable. On a persistent failure the subscription is
  // still live, so we log the billing identifiers at error level (they are
  // about to be deleted with the user) so the orphaned subscription can be
  // resolved. (A durable retry queue is a tracked follow-up.)
  if (isStripeConfigured()) {
    const row = await getEntitlementRow(userId);
    if (row?.stripeSubscriptionId) {
      const res = await cancelSubscriptionWithRetry(row.stripeSubscriptionId);
      if (!res.ok) {
        logger.error("billing.cancel_failed", {
          marker: "orphaned-subscription",
          userId,
          stripeSubscriptionId: row.stripeSubscriptionId,
          stripeCustomerId: row.stripeCustomerId ?? null,
          attempts: res.attempts,
          error: res.error,
        });
      }
    }
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not delete your account." };
  }
}
