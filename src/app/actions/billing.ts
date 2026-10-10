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

export interface EmbeddedCheckoutResult {
  /** Client secret for `EmbeddedCheckoutProvider`. */
  clientSecret?: string;
  error?: string;
}

export interface CheckoutSessionState {
  /** Stripe session status: "open" | "complete" | "expired", or null. */
  status: string | null;
  /** "paid" | "unpaid" | "no_payment_required", or null. */
  paymentStatus: string | null;
  /** Plan the session was created for (from our metadata), or null. */
  plan: string | null;
  /** Amount actually charged, in major units (after discounts), or null. */
  amount: number | null;
  /** Lower-case ISO currency code, or null. */
  currency: string | null;
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
      success_url: `${origin}/?billing=success&plan=${plan}&sid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?billing=cancelled`,
    });
    return checkout.url ? { url: checkout.url } : { error: "Stripe did not return a checkout URL." };
  } catch (err) {
    // Surface the provider message verbatim (req 12 spirit).
    return { error: err instanceof Error ? err.message : "Could not start checkout." };
  }
}

/**
 * Create an **embedded** Checkout session for a paid plan and return its
 * `client_secret` so the Stripe payment UI can render on an orire-branded page
 * (no redirect away). The webhook remains the authoritative entitlement writer;
 * on completion Stripe navigates the browser to `return_url`.
 */
export async function createCheckoutSession(plan: PlanId): Promise<EmbeddedCheckoutResult> {
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
      ui_mode: "embedded",
      mode: "subscription",
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      metadata: { userId, plan },
      subscription_data: { metadata: { userId, plan } },
      return_url: `${origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
    });
    return checkout.client_secret
      ? { clientSecret: checkout.client_secret }
      : { error: "Stripe did not return a checkout secret." };
  } catch (err) {
    // Surface the provider message verbatim (req 12 spirit).
    return { error: err instanceof Error ? err.message : "Could not start checkout." };
  }
}

/** Read the status of a Checkout session (used by the return page). */
export async function checkoutSessionStatus(sessionId: string): Promise<CheckoutSessionState> {
  const none: CheckoutSessionState = {
    status: null,
    paymentStatus: null,
    plan: null,
    amount: null,
    currency: null,
  };
  if (!isStripeConfigured() || !sessionId) return none;
  try {
    const stripe = getStripe();
    const s = await stripe.checkout.sessions.retrieve(sessionId);
    return {
      status: s.status ?? null,
      paymentStatus: s.payment_status ?? null,
      plan: s.metadata?.plan ?? null,
      amount: s.amount_total != null ? s.amount_total / 100 : null,
      currency: s.currency ?? null,
    };
  } catch {
    return none;
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

export interface VerifiedPurchase {
  ok: boolean;
  plan?: PlanId;
  /** Amount charged in major currency units (e.g. dollars), when known. */
  amountTotal?: number;
  currency?: string;
}

/**
 * Server-side confirmation that a Checkout session was actually paid and
 * belongs to the signed-in user. Used by the client PurchaseTracker before it
 * fires a conversion event, so the success-URL params alone can't be forged
 * into a fabricated "Purchase". Fails closed (ok:false) on any doubt.
 */
export async function verifyCheckoutSession(sid: string): Promise<VerifiedPurchase> {
  if (!isStripeConfigured() || !sid || typeof sid !== "string") return { ok: false };
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return { ok: false };
  try {
    const cs = await getStripe().checkout.sessions.retrieve(sid);
    const owner =
      (cs.metadata?.userId as string | undefined) ??
      (typeof cs.client_reference_id === "string" ? cs.client_reference_id : null);
    const paid = cs.payment_status === "paid" || cs.status === "complete";
    if (!paid || owner !== userId) return { ok: false };
    const plan = cs.metadata?.plan as PlanId | undefined;
    const amountTotal = typeof cs.amount_total === "number" ? cs.amount_total / 100 : undefined;
    const currency = cs.currency ?? undefined;
    return { ok: true, plan, amountTotal, currency };
  } catch {
    return { ok: false };
  }
}
