/**
 * orire — billing server actions (Phase B2).
 *
 * These drive Stripe Checkout and the Customer Portal for signed-in users.
 * The webhook (`/api/billing/webhook`) remains the authoritative writer of the
 * `Entitlement` row; these actions only create redirect sessions and ensure a
 * Stripe customer exists first.
 *
 * When Stripe isn't configured (`STRIPE_SECRET_KEY` absent) `billingStatus`
 * reports `configured:false` and the UI falls back to B1's dev plan switch.
 */

"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import type { PlanId } from "@/lib/plan/plan";
import { getStripe, isStripeConfigured, priceIdForPlan } from "@/lib/billing/stripe";
import {
  getEntitlementRow,
  getEntitlementSummary,
  linkStripeCustomer,
} from "@/lib/entitlement/entitlement";

export interface BillingStatus {
  configured: boolean;
  signedIn: boolean;
  plan: PlanId;
  /** True when the account has an active paid subscription on record. */
  hasSubscription: boolean;
  /** True when a Customer Portal session can be opened (customer exists). */
  canManage: boolean;
  /** Raw Stripe subscription status (active, trialing, past_due…), or null. */
  status: string | null;
  /** Current period end as ISO (renewal/cancel date), or null. */
  renewsAt: string | null;
}

export interface RedirectResult {
  url?: string;
  error?: string;
}

/** Build the app origin from the incoming request (falls back to APP_URL/env). */
async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return process.env.APP_URL ?? "http://localhost:3001";
}

/** Report billing capability + current subscription state for the UI. */
export async function billingStatus(): Promise<BillingStatus> {
  const configured = isStripeConfigured();
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return {
      configured,
      signedIn: false,
      plan: "free",
      hasSubscription: false,
      canManage: false,
      status: null,
      renewsAt: null,
    };
  }
  const [summary, row] = await Promise.all([
    getEntitlementSummary(userId),
    getEntitlementRow(userId),
  ]);
  const hasSubscription = Boolean(row?.stripeSubscriptionId) && summary.plan !== "free";
  return {
    configured,
    signedIn: true,
    plan: summary.plan,
    hasSubscription,
    canManage: configured && Boolean(row?.stripeCustomerId),
    status: row?.status ?? null,
    renewsAt: row?.currentPeriodEnd?.toISOString() ?? null,
  };
}

/**
 * Create (or reuse) the Stripe customer for the signed-in user and return its
 * id, ensuring the id is persisted on the entitlement row before Checkout so
 * the first subscription webhook can resolve the user.
 */
async function ensureCustomerId(userId: string, email: string | null | undefined): Promise<string> {
  const row = await getEntitlementRow(userId);
  if (row?.stripeCustomerId) return row.stripeCustomerId;
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { userId },
  });
  await linkStripeCustomer(userId, customer.id);
  return customer.id;
}

/** Start a Checkout session for a paid plan. Returns a redirect URL. */
export async function startCheckout(plan: PlanId): Promise<RedirectResult> {
  if (!isStripeConfigured()) return { error: "Billing isn’t configured on this server." };
  if (plan === "free") return { error: "The Free plan doesn’t require checkout." };

  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return { error: "Sign in to subscribe." };

  const priceId = priceIdForPlan(plan);
  if (!priceId) return { error: `No Stripe price configured for the ${plan} plan.` };

  try {
    const customerId = await ensureCustomerId(userId, session?.user?.email);
    const origin = await appOrigin();
    const stripe = getStripe();
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      metadata: { userId, plan },
      subscription_data: { metadata: { userId, plan } },
      success_url: `${origin}/?billing=success`,
      cancel_url: `${origin}/?billing=cancelled`,
    });
    return checkout.url ? { url: checkout.url } : { error: "Stripe did not return a checkout URL." };
  } catch (err) {
    // Surface the provider message verbatim (req 12 spirit).
    return { error: err instanceof Error ? err.message : "Could not start checkout." };
  }
}

/** Open the Stripe Customer Portal so the user can manage/cancel billing. */
export async function openBillingPortal(): Promise<RedirectResult> {
  if (!isStripeConfigured()) return { error: "Billing isn’t configured on this server." };

  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return { error: "Sign in to manage billing." };

  const row = await getEntitlementRow(userId);
  if (!row?.stripeCustomerId) return { error: "No billing account on file yet." };

  try {
    const origin = await appOrigin();
    const stripe = getStripe();
    const portal = await stripe.billingPortal.sessions.create({
      customer: row.stripeCustomerId,
      return_url: `${origin}/?billing=portal`,
    });
    return { url: portal.url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not open the billing portal." };
  }
}
