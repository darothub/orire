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
import { requireVerifiedAction } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { cancelSubscriptionWithRetry, isStripeConfigured } from "@/lib/billing/stripe";
import { getEntitlementRow } from "@/lib/entitlement/entitlement";
import { logger } from "@/lib/obs/logger";

export interface DeleteAccountResult {
  ok?: true;
  error?: string;
}

export type ExportAccountResult = { ok: true; data: unknown } | { ok: false; error: string };

/**
 * GDPR data-portability export: gather everything orire holds about the
 * signed-in user into a single JSON structure the client downloads. Secrets are
 * deliberately excluded — password hash, OAuth access/refresh tokens, session
 * tokens and single-use email/reset tokens never leave the server. Dates
 * serialize to ISO via the caller's JSON.stringify.
 */
export async function exportAccountData(): Promise<ExportAccountResult> {
  // Browse-only: full data export is a product feature, not a bare auth action.
  // Account *deletion* stays sign-in-only so unverified users can leave.
  const gate = await requireVerifiedAction("export your account data");
  if (!gate.ok) return { ok: false, error: gate.message };
  const userId = gate.userId;

  const [user, accounts, entitlement, documents, refineRuns, exportEvents, usage, memberships, ownedTeams] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, emailVerified: true, image: true, createdAt: true, activeDocumentId: true },
      }),
      // OAuth links: provider identity only — never the stored tokens.
      prisma.account.findMany({ where: { userId }, select: { provider: true, type: true, providerAccountId: true } }),
      prisma.entitlement.findUnique({
        where: { userId },
        select: { plan: true, status: true, stripeCustomerId: true, stripeSubscriptionId: true, currentPeriodEnd: true, updatedAt: true },
      }),
      prisma.document.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }),
      prisma.refineRun.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      prisma.exportEvent.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      prisma.usageCounter.findMany({ where: { userId }, select: { metric: true, period: true, count: true } }),
      prisma.teamMember.findMany({ where: { userId }, select: { teamId: true, role: true, createdAt: true } }),
      prisma.team.findMany({ where: { ownerId: userId }, select: { id: true, name: true, plan: true, seatLimit: true, createdAt: true } }),
    ]);

  if (!user) return { ok: false, error: "Account not found." };

  return {
    ok: true,
    data: {
      format: "orire-account-export-v1",
      exportedAt: new Date().toISOString(),
      account: user,
      authProviders: accounts,
      plan: entitlement,
      usage,
      documents,
      refineRuns,
      exportEvents,
      teams: { memberships, owned: ownedTeams },
    },
  };
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
