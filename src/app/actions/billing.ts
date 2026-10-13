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
import type Stripe from "stripe";
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

/* -------------------------------------------------------------------------- */
/*  Custom in-app billing (Payment Element + self-hosted manage panel).       */
/*                                                                            */
/*  These power orire's own subscription form and billing panel in place of   */
/*  Stripe-hosted Checkout + the Customer Portal. Card data is still captured  */
/*  by Stripe Elements in the browser and never touches our server, so PCI    */
/*  scope stays with Stripe. The webhook remains the authoritative writer of   */
/*  the Entitlement row — these actions only talk to the Stripe API and let    */
/*  the resulting subscription events reconcile our mirror.                    */
/* -------------------------------------------------------------------------- */

export interface CardInfo {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

export interface BillingDetail extends BillingStatus {
  /** The Stripe subscription id, when one is on record. */
  subscriptionId: string | null;
  /** True when the subscription is set to end at the current period's close. */
  cancelAtPeriodEnd: boolean;
  /** Default card on file (brand + last 4), or null. */
  card: CardInfo | null;
  /** Monthly amount of the current subscription price, in major units. */
  amount: number | null;
  /** Lower-case ISO currency, or null. */
  currency: string | null;
}

export interface SubscriptionIntent {
  clientSecret?: string;
  subscriptionId?: string;
  /** Set when the caller already has an active subscription (switch instead). */
  alreadySubscribed?: boolean;
  error?: string;
}

export interface SetupIntentResult {
  clientSecret?: string;
  error?: string;
}

export interface MutationResult {
  ok?: boolean;
  error?: string;
}

/** Narrow a possibly-string/expandable reference to its object form. */
function asObject<T extends { id: string }>(v: string | T | null | undefined): T | null {
  return v && typeof v !== "string" ? v : null;
}

/**
 * Pull the client secret a browser needs to confirm the first subscription
 * invoice. Robust across Stripe API versions: newer accounts expose it on the
 * invoice's `confirmation_secret`, older ones on an expanded `payment_intent`.
 */
async function firstInvoiceClientSecret(
  stripe: Stripe,
  invoice: string | Stripe.Invoice | null | undefined,
): Promise<string | null> {
  const invoiceId = typeof invoice === "string" ? invoice : invoice?.id;
  if (!invoiceId) return null;

  // Prefer the already-expanded object when present, else retrieve it. Expand
  // both shapes, retrying without `confirmation_secret` for API versions that
  // don't know that field (passing an unknown expand path errors otherwise).
  let inv: Stripe.Invoice;
  if (invoice && typeof invoice !== "string") {
    inv = invoice;
  } else {
    try {
      inv = await stripe.invoices.retrieve(invoiceId, {
        expand: ["payment_intent", "confirmation_secret"],
      });
    } catch {
      inv = await stripe.invoices.retrieve(invoiceId, { expand: ["payment_intent"] });
    }
  }

  const withSecrets = inv as unknown as {
    confirmation_secret?: { client_secret?: string } | null;
    payment_intent?: string | { client_secret?: string | null } | null;
  };

  if (withSecrets.confirmation_secret?.client_secret) {
    return withSecrets.confirmation_secret.client_secret;
  }
  const pi = withSecrets.payment_intent;
  if (pi) {
    if (typeof pi === "string") {
      const got = await stripe.paymentIntents.retrieve(pi);
      return got.client_secret ?? null;
    }
    if (pi.client_secret) return pi.client_secret;
  }
  // Last resort: the invoice carried no expandable secret inline — fetch it.
  try {
    const refetched = await stripe.invoices.retrieve(invoiceId, {
      expand: ["confirmation_secret"],
    });
    const cs = (refetched as unknown as { confirmation_secret?: { client_secret?: string } })
      .confirmation_secret?.client_secret;
    return cs ?? null;
  } catch {
    return null;
  }
}

/** The price currently attached to a subscription, and its amount. */
function priceOf(sub: Stripe.Subscription): { id: string | null; amount: number | null; currency: string | null } {
  const price = sub.items.data[0]?.price;
  return {
    id: price?.id ?? null,
    amount: price?.unit_amount != null ? price.unit_amount / 100 : null,
    currency: price?.currency ?? null,
  };
}

/**
 * Rich billing snapshot for the custom panel — extends `billingStatus` with the
 * live subscription's cancel-at-period-end flag, default card and price. Reads
 * the subscription from Stripe (not persisted) so no schema change is needed.
 */
export async function billingDetail(): Promise<BillingDetail> {
  const base = await billingStatus();
  const empty: BillingDetail = {
    ...base,
    subscriptionId: null,
    cancelAtPeriodEnd: false,
    card: null,
    amount: null,
    currency: null,
  };
  if (!base.configured || !base.signedIn) return empty;

  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return empty;
  const row = await getEntitlementRow(userId);
  if (!row?.stripeSubscriptionId) return empty;

  try {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId, {
      expand: ["default_payment_method"],
    });
    const price = priceOf(sub);
    const pm = asObject<Stripe.PaymentMethod>(
      sub.default_payment_method as string | Stripe.PaymentMethod | null,
    );
    const card = pm?.card
      ? {
          brand: pm.card.brand ?? null,
          last4: pm.card.last4 ?? null,
          expMonth: pm.card.exp_month ?? null,
          expYear: pm.card.exp_year ?? null,
        }
      : null;
    return {
      ...base,
      subscriptionId: sub.id,
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      card,
      amount: price.amount,
      currency: price.currency,
    };
  } catch {
    // On any Stripe read error, fall back to the base snapshot — the panel
    // still renders plan/status from our mirror.
    return empty;
  }
}

/**
 * Create (or reuse) an incomplete subscription for a paid plan and return the
 * client secret the browser's Payment Element confirms. The webhook flips the
 * entitlement to active once payment succeeds.
 */
export async function createSubscription(plan: PlanId): Promise<SubscriptionIntent> {
  if (!isStripeConfigured()) return { error: "Billing isn’t configured on this server." };
  if (plan === "free") return { error: "The Free plan doesn’t require a subscription." };

  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return { error: "Sign in to subscribe." };

  const priceId = priceIdForPlan(plan);
  if (!priceId) return { error: `No Stripe price configured for the ${plan} plan.` };

  try {
    const stripe = getStripe();
    const customerId = await ensureCustomerId(userId, session?.user?.email);

    // Already paying? Don't stack subscriptions — the caller should switch plan.
    const existing = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    const live = existing.data.find((s) =>
      ["active", "trialing", "past_due"].includes(s.status),
    );
    if (live) return { alreadySubscribed: true, error: "You already have an active subscription." };

    // Reuse an existing incomplete subscription for the same price (e.g. the
    // modal was reopened) rather than minting a fresh one each time.
    const reusable = existing.data.find(
      (s) => s.status === "incomplete" && s.items.data[0]?.price?.id === priceId,
    );
    if (reusable) {
      const secret = await firstInvoiceClientSecret(stripe, reusable.latest_invoice);
      if (secret) return { clientSecret: secret, subscriptionId: reusable.id };
    }

    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      metadata: { userId, plan },
      expand: ["latest_invoice.payment_intent", "latest_invoice.confirmation_secret"],
    });

    const secret = await firstInvoiceClientSecret(stripe, sub.latest_invoice);
    if (!secret) return { error: "Stripe did not return a payment secret for this subscription." };
    return { clientSecret: secret, subscriptionId: sub.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not start the subscription." };
  }
}

/**
 * Switch an existing subscription to a different paid plan, prorating the
 * difference against the card on file. The webhook remaps the plan on the
 * resulting `customer.subscription.updated` event.
 */
export async function switchPlan(plan: PlanId): Promise<MutationResult> {
  if (!isStripeConfigured()) return { error: "Billing isn’t configured on this server." };
  if (plan === "free") return { error: "Use cancel to move to the Free plan." };

  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return { error: "Sign in to change your plan." };

  const priceId = priceIdForPlan(plan);
  if (!priceId) return { error: `No Stripe price configured for the ${plan} plan.` };

  const row = await getEntitlementRow(userId);
  if (!row?.stripeSubscriptionId) return { error: "No active subscription to change." };

  try {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(row.stripeSubscriptionId);
    const item = sub.items.data[0];
    if (!item) return { error: "Subscription has no line item to update." };
    if (item.price?.id === priceId) return { ok: true }; // already on this plan

    await stripe.subscriptions.update(sub.id, {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: "create_prorations",
      metadata: { ...(sub.metadata ?? {}), userId, plan },
    });
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not change your plan." };
  }
}

/**
 * Schedule cancellation at the end of the current period (keeps access until
 * then). The subscription stays active, so the entitlement is untouched until
 * Stripe fires `customer.subscription.deleted` at period end.
 */
export async function cancelSubscription(): Promise<MutationResult> {
  if (!isStripeConfigured()) return { error: "Billing isn’t configured on this server." };
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return { error: "Sign in to manage billing." };

  const row = await getEntitlementRow(userId);
  if (!row?.stripeSubscriptionId) return { error: "No active subscription to cancel." };

  try {
    await getStripe().subscriptions.update(row.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not cancel the subscription." };
  }
}

/** Undo a scheduled cancellation while the subscription is still active. */
export async function resumeSubscription(): Promise<MutationResult> {
  if (!isStripeConfigured()) return { error: "Billing isn’t configured on this server." };
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return { error: "Sign in to manage billing." };

  const row = await getEntitlementRow(userId);
  if (!row?.stripeSubscriptionId) return { error: "No subscription to resume." };

  try {
    await getStripe().subscriptions.update(row.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not resume the subscription." };
  }
}

/**
 * Create a SetupIntent so the browser can collect a new card via Elements and
 * save it for off-session subscription charges. Returns the client secret.
 */
export async function createCardSetupIntent(): Promise<SetupIntentResult> {
  if (!isStripeConfigured()) return { error: "Billing isn’t configured on this server." };
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return { error: "Sign in to update your card." };

  try {
    const stripe = getStripe();
    const customerId = await ensureCustomerId(userId, session?.user?.email);
    const intent = await stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session",
      automatic_payment_methods: { enabled: true },
    });
    return intent.client_secret ? { clientSecret: intent.client_secret } : { error: "Stripe did not return a setup secret." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not start a card update." };
  }
}

/**
 * Make a (just-collected) payment method the default for both the customer's
 * invoices and the active subscription. The payment method must already be
 * attached to the customer (SetupIntent confirmation does this).
 */
export async function setDefaultPaymentMethod(paymentMethodId: string): Promise<MutationResult> {
  if (!isStripeConfigured()) return { error: "Billing isn’t configured on this server." };
  if (!paymentMethodId || typeof paymentMethodId !== "string") return { error: "No card to set." };

  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return { error: "Sign in to update your card." };

  const row = await getEntitlementRow(userId);
  if (!row?.stripeCustomerId) return { error: "No billing account on file." };

  try {
    const stripe = getStripe();
    // Verify the payment method belongs to this customer before trusting the id
    // from the client — never set a card we can't confirm ownership of.
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    const owner = typeof pm.customer === "string" ? pm.customer : pm.customer?.id ?? null;
    if (owner !== row.stripeCustomerId) return { error: "That card isn’t on your account." };

    await stripe.customers.update(row.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    if (row.stripeSubscriptionId) {
      await stripe.subscriptions.update(row.stripeSubscriptionId, {
        default_payment_method: paymentMethodId,
      });
    }
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not update your card." };
  }
}
