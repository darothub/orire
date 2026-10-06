/**
 * orire — Stripe webhook idempotency ledger.
 *
 * Stripe delivers events at-least-once and will retry on any non-2xx, so the
 * same `event.id` can reach the handler multiple times (and concurrently). We
 * claim each event id in Postgres before processing:
 *
 *   - `claimWebhookEvent` inserts the id. A fresh insert → process the event.
 *     A unique-constraint collision → it's a duplicate/concurrent delivery, so
 *     the caller skips the handler and still acks 200.
 *   - `releaseWebhookEvent` deletes the claim when the handler fails, so
 *     Stripe's retry is allowed to reprocess the event later.
 *
 * Any other DB error propagates so the route 500s and Stripe retries, rather
 * than silently dropping an event.
 */

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/obs/logger";

/** Prisma unique-constraint violation (the id is already claimed). */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

export interface WebhookClaim {
  /** True when this call won the claim and the caller should process the event. */
  claimed: boolean;
}

/**
 * Claim a Stripe event id. Returns `{ claimed: true }` on the first delivery and
 * `{ claimed: false }` for any duplicate. Re-throws unexpected DB errors.
 */
export async function claimWebhookEvent(id: string, type: string): Promise<WebhookClaim> {
  try {
    await prisma.processedWebhookEvent.create({ data: { id, type } });
    return { claimed: true };
  } catch (err) {
    if (isUniqueViolation(err)) {
      logger.info("webhook.duplicate", { eventId: id, type });
      return { claimed: false };
    }
    throw err;
  }
}

/** Release a claim so a failed event can be retried by Stripe. Best-effort. */
export async function releaseWebhookEvent(id: string): Promise<void> {
  try {
    await prisma.processedWebhookEvent.delete({ where: { id } });
  } catch {
    // The row may already be gone; nothing actionable to do here.
  }
}
