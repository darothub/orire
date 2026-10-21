/**
 * orire — lifecycle/activation-email idempotency ledger (P1-12).
 *
 * The activation-nudge cron runs hourly and re-scans every user whose signup
 * falls in the 24–48h window on each run, so the same user can be seen by
 * several sweeps before they age out of it. We claim `(userId, kind)` in
 * Postgres before sending — mirrors `webhookDedupe.ts`'s pattern exactly:
 *
 *   - `claimLifecycleEmail` inserts the row. A fresh insert → send the email.
 *     A unique-constraint collision → already sent (or a concurrent sweep is
 *     sending it right now), so the caller skips it.
 *   - `releaseLifecycleEmail` deletes the claim if `sendMail` itself throws,
 *     so the next hourly sweep (while the user is still in the window) can
 *     retry rather than silently losing the nudge to a transient send failure.
 *
 * Any other DB error propagates so the cron run fails loudly instead of
 * silently skipping users.
 */

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/obs/logger";

/** Prisma unique-constraint violation (already claimed). */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

export interface LifecycleEmailClaim {
  /** True when this call won the claim and the caller should send the email. */
  claimed: boolean;
}

/** Claim one (userId, kind) nudge. Re-throws unexpected DB errors. */
export async function claimLifecycleEmail(userId: string, kind: string): Promise<LifecycleEmailClaim> {
  try {
    await prisma.lifecycleEmail.create({ data: { userId, kind } });
    return { claimed: true };
  } catch (err) {
    if (isUniqueViolation(err)) {
      logger.debug("lifecycle.email.already_sent", { userId, kind });
      return { claimed: false };
    }
    throw err;
  }
}

/** Release a claim so a failed send can be retried by a later sweep. Best-effort. */
export async function releaseLifecycleEmail(userId: string, kind: string): Promise<void> {
  try {
    await prisma.lifecycleEmail.delete({ where: { userId_kind: { userId, kind } } });
  } catch {
    // The row may already be gone; nothing actionable to do here.
  }
}
