/**
 * orire — browser-side Stripe loader (Phase B3, embedded checkout).
 *
 * The publishable key is public by design and inlined into the client bundle
 * via `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. When it's absent the embedded
 * checkout can't render, so the UI falls back to the hosted Checkout redirect.
 *
 * `loadStripe` is memoised so the Stripe.js script is fetched only once.
 */

import { loadStripe, type Stripe } from "@stripe/stripe-js";

/** Public Stripe key (safe to expose). Empty string when unconfigured. */
export const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

/** Whether embedded checkout can run in the browser (publishable key present). */
export function canEmbedCheckout(): boolean {
  return STRIPE_PUBLISHABLE_KEY.length > 0;
}

let promise: Promise<Stripe | null> | null = null;

/** Memoised Stripe.js instance, or null when no publishable key is configured. */
export function getStripePromise(): Promise<Stripe | null> {
  if (!STRIPE_PUBLISHABLE_KEY) return Promise.resolve(null);
  promise ??= loadStripe(STRIPE_PUBLISHABLE_KEY);
  return promise;
}
