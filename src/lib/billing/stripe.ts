/**
 * orire — Stripe client + plan/price mapping (Phase B2).
 *
 * Stripe is optional: with no `STRIPE_SECRET_KEY` the app falls back to the
 * dev plan switch (B1's `devSetPlan`) so local development needs zero billing
 * secrets. When configured, paid plans go through Checkout and the webhook
 * writes the authoritative `Entitlement` row.
 *
 * Price ids are supplied per-plan via env so the same code works across test
 * and live modes without recompiling.
 */

import Stripe from "stripe";
import type { PlanId } from "@/lib/plan/plan";

let cached: Stripe | null = null;

/** Whether Stripe billing is configured in this environment. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Lazily-constructed Stripe client. Throws if the secret key is absent. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  // Pin the SDK's bundled API version by omitting apiVersion (uses the
  // account default), avoiding literal-type churn across SDK upgrades.
  cached ??= new Stripe(key);
  return cached;
}

/** Env var name that holds the Stripe price id for a paid plan. */
const PRICE_ENV: Record<Exclude<PlanId, "free">, string> = {
  pro: "STRIPE_PRICE_PRO",
  career: "STRIPE_PRICE_CAREER",
};

/** The configured Stripe price id for a plan, or null when unset/free. */
export function priceIdForPlan(plan: PlanId): string | null {
  if (plan === "free") return null;
  return process.env[PRICE_ENV[plan]] ?? null;
}

/**
 * Stripe Tax (EU VAT) options shared by both Checkout flows — one source of
 * truth so the two sessions can't drift:
 *  - `automatic_tax` — Stripe computes and adds VAT from the customer's location.
 *  - `billing_address_collection: "required"` — automatic_tax needs a location
 *    to tax against, so Checkout must capture a billing address.
 *  - `customer_update` — persist the address (and name) Checkout collects back
 *    onto the Customer; required when a `customer` is preset and automatic_tax
 *    is on, and it keeps the tax location for renewals.
 *  - `tax_id_collection` — let business customers enter a VAT ID for B2B
 *    reverse-charge.
 *
 * OPS: Stripe Tax must be activated in the Stripe Dashboard (origin address +
 * registrations) for `automatic_tax` to succeed; until then these sessions
 * error with a tax-not-active message.
 */
export const CHECKOUT_TAX_OPTS = {
  automatic_tax: { enabled: true },
  billing_address_collection: "required",
  customer_update: { address: "auto", name: "auto" },
  tax_id_collection: { enabled: true },
} as const satisfies Partial<Stripe.Checkout.SessionCreateParams>;

/** Reverse map a Stripe price id back to a plan id (for webhook handling). */
export function planForPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const plan of ["pro", "career"] as const) {
    if (process.env[PRICE_ENV[plan]] === priceId) return plan;
  }
  return null;
}

export interface CancelResult {
  ok: boolean;
  attempts: number;
  error?: string;
}

/**
 * Cancel a Stripe subscription with bounded retries so a transient failure
 * (network blip, brief Stripe outage) doesn't leave a leaving customer billed.
 * The canceller is injectable for tests. On persistent failure the caller is
 * responsible for retaining the billing identifiers (see deleteAccount), since
 * the subscription is still live.
 */
export async function cancelSubscriptionWithRetry(
  subscriptionId: string,
  opts: {
    attempts?: number;
    delaysMs?: number[];
    cancelFn?: (id: string) => Promise<unknown>;
  } = {},
): Promise<CancelResult> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const delays = opts.delaysMs ?? [300, 800];
  const cancel = opts.cancelFn ?? ((id: string) => getStripe().subscriptions.cancel(id));
  let lastError = "";
  for (let i = 0; i < attempts; i++) {
    try {
      await cancel(subscriptionId);
      return { ok: true, attempts: i + 1 };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (i < attempts - 1) {
        const wait = delays[i] ?? delays[delays.length - 1] ?? 0;
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  return { ok: false, attempts, error: lastError };
}
