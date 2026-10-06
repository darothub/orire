/**
 * orire — Stripe webhook (Phase B2).
 *
 * The authoritative writer of paid `Entitlement` state. Checkout and the
 * Customer Portal both fan out to subscription lifecycle events which we map
 * to plan changes here. Signature is verified against `STRIPE_WEBHOOK_SECRET`
 * over the raw request body, so this route must NOT parse JSON first.
 */

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured, planForPriceId } from "@/lib/billing/stripe";
import {
  applyStripeSubscription,
  clearStripeSubscription,
} from "@/lib/entitlement/entitlement";
import { claimWebhookEvent, releaseWebhookEvent } from "@/lib/billing/webhookDedupe";
import { logger } from "@/lib/obs/logger";

export const runtime = "nodejs";
// Never cache; every event must hit the handler.
export const dynamic = "force-dynamic";

/** Resolve the customer id from a Stripe object that may inline or reference it. */
function customerId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** Map a Subscription to the entitlement state we persist. */
function subscriptionState(sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price?.id ?? null;
  const plan = planForPriceId(priceId);
  // `current_period_end` is unix seconds; fall back to the item when the
  // top-level field is absent on newer API shapes.
  const periodEnd =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    (sub.items.data[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end ??
    null;
  return {
    plan,
    status: sub.status,
    stripeSubscriptionId: sub.id,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
  };
}

export async function POST(req: Request) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Billing not configured." }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  const stripe = getStripe();
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature.";
    return NextResponse.json({ error: `Webhook signature failed: ${message}` }, { status: 400 });
  }

  // Idempotency: claim the event id before handling. Stripe retries and
  // at-least-once delivery mean the same event can arrive repeatedly; a losing
  // claim is a duplicate we ack without re-applying.
  const claim = await claimWebhookEvent(event.id, event.type);
  if (!claim.claimed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const cust = customerId(session.customer);
        const subId = customerId(session.subscription);
        if (cust && subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          const state = subscriptionState(sub);
          if (state.plan) {
            await applyStripeSubscription(cust, { ...state, plan: state.plan });
          }
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const cust = customerId(sub.customer);
        const state = subscriptionState(sub);
        if (cust) {
          const active = sub.status === "active" || sub.status === "trialing";
          if (active && state.plan) {
            await applyStripeSubscription(cust, { ...state, plan: state.plan });
          } else if (!active) {
            // Past-due / unpaid / incomplete → drop paid access but keep the id.
            await clearStripeSubscription(cust, sub.status);
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const cust = customerId(sub.customer);
        if (cust) await clearStripeSubscription(cust, "canceled");
        break;
      }
      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (err) {
    // A handler failure should 500 so Stripe retries later. Release the claim
    // so the retry isn't swallowed as a duplicate.
    await releaseWebhookEvent(event.id);
    const message = err instanceof Error ? err.message : "Handler error.";
    logger.error("webhook.handler_failed", { eventId: event.id, type: event.type, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
