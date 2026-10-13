"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type { Appearance } from "@stripe/stripe-js";
import { getStripePromise } from "@/lib/billing/stripe-client";
import { createSubscription } from "@/app/actions/billing";
import { PLANS, type PlanId } from "@/lib/plan/plan";

/**
 * orire's own subscription form — a fully custom overlay built on Stripe's
 * Payment Element. We create an incomplete subscription server-side, then the
 * Payment Element collects the card (card data goes straight to Stripe, never
 * our server) and confirms the first invoice. The webhook flips the plan to
 * active; this component just drives the UI and refreshes on success.
 */
export function SubscribeModal({
  plan,
  onClose,
  onDone,
  onAlreadySubscribed,
}: {
  plan: PlanId;
  onClose: () => void;
  /** Called after a successful (or processing) confirmation. */
  onDone: () => void;
  /** Called when the account already has an active subscription. */
  onAlreadySubscribed?: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Esc closes the modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Create the incomplete subscription once, for the selected plan.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await createSubscription(plan);
      if (cancelled) return;
      if (r.alreadySubscribed) {
        onAlreadySubscribed?.();
        onClose();
        return;
      }
      if (r.clientSecret) setClientSecret(r.clientSecret);
      else setError(r.error ?? "Could not start the subscription.");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const appearance = useMemo<Appearance>(
    () => ({
      theme: "night",
      variables: {
        colorPrimary: "#6ea8fe",
        colorBackground: "#0f1115",
        colorText: "#e8eaed",
        borderRadius: "10px",
        fontFamily: "inherit",
      },
    }),
    [],
  );

  if (typeof document === "undefined") return null;
  const p = PLANS[plan];

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="checkout-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          className="checkout-card"
          role="dialog"
          aria-modal="true"
          aria-label={`Subscribe to ${p.label}`}
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="checkout-head">
            <div className="checkout-title">
              <span className="checkout-eyebrow">Subscribe</span>
              <strong>
                {p.label} · ${p.price}
                <em>/mo</em>
              </strong>
            </div>
            <button className="checkout-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>

          <div className="checkout-body">
            {error ? (
              <div className="checkout-error" role="alert">
                <p>{error}</p>
                <button className="checkout-retry" onClick={onClose}>
                  Close
                </button>
              </div>
            ) : clientSecret ? (
              <Elements stripe={getStripePromise()} options={{ clientSecret, appearance }}>
                <SubscribeForm planLabel={p.label} price={p.price} onDone={onDone} />
              </Elements>
            ) : (
              <div className="checkout-loading" aria-live="polite">
                <span className="checkout-spinner" aria-hidden />
                Preparing secure form…
              </div>
            )}
          </div>

          <p className="checkout-foot">
            Payments are processed by Stripe. Orire never sees your card details.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

/** The inner form — must live inside <Elements> to use the Stripe hooks. */
function SubscribeForm({
  planLabel,
  price,
  onDone,
}: {
  planLabel: string;
  price: number;
  onDone: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setErr(null);

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      // Only redirects for cards that require it (e.g. 3-D Secure); otherwise
      // resolves inline and we handle success here.
      confirmParams: { return_url: `${origin}/?billing=processing` },
      redirect: "if_required",
    });

    if (error) {
      setErr(error.message ?? "Payment could not be completed.");
      setBusy(false);
      return;
    }
    // succeeded | processing → treat as done; the webhook finalises the plan.
    if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) {
      onDone();
      return;
    }
    // Any other status (e.g. requires_action resolved via redirect) — the
    // return page / refresh will reflect the real state.
    onDone();
  };

  return (
    <form onSubmit={submit} className="subscribe-form">
      <PaymentElement onReady={() => setReady(true)} />
      {err && (
        <div className="checkout-error" role="alert" style={{ marginTop: 12 }}>
          <p>{err}</p>
        </div>
      )}
      <button type="submit" className="subscribe-pay" disabled={!stripe || !ready || busy}>
        {busy ? "Confirming…" : `Subscribe to ${planLabel} · $${price}/mo`}
      </button>
    </form>
  );
}
