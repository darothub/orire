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

/** Reverse map a Stripe price id back to a plan id (for webhook handling). */
export function planForPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const plan of ["pro", "career"] as const) {
    if (process.env[PRICE_ENV[plan]] === priceId) return plan;
  }
  return null;
}
