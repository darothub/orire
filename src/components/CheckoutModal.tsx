"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { getStripePromise } from "@/lib/billing/stripe-client";
import { createCheckoutSession } from "@/app/actions/billing";
import { PLANS, type PlanId } from "@/lib/plan/plan";

/**
 * Embedded Stripe Checkout, hosted on an orire-branded overlay (Phase B3).
 *
 * Mounting fetches a `client_secret` for the chosen plan via a server action,
 * then renders Stripe's secure embedded form inside our own modal — the user
 * never leaves orire. On success Stripe navigates the browser to the return
 * route, which reconciles state and bounces back to the app.
 */
export function CheckoutModal({
  plan,
  onClose,
}: {
  plan: PlanId;
  onClose: () => void;
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

  // Create the session once, for the selected plan.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await createCheckoutSession(plan);
      if (cancelled) return;
      if (r.clientSecret) setClientSecret(r.clientSecret);
      else setError(r.error ?? "Could not start checkout.");
    })();
    return () => {
      cancelled = true;
    };
  }, [plan]);

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
              <span className="checkout-eyebrow">Secure checkout</span>
              <strong>
                {p.label} · ${p.price}
                <em>/mo</em>
              </strong>
            </div>
            <button className="checkout-close" onClick={onClose} aria-label="Close checkout">
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
              <EmbeddedCheckoutProvider
                stripe={getStripePromise()}
                options={{ clientSecret }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            ) : (
              <div className="checkout-loading" aria-live="polite">
                <span className="checkout-spinner" aria-hidden />
                Preparing secure checkout…
              </div>
            )}
          </div>

          <p className="checkout-foot">
            Payments are processed by Stripe. orire never sees your card details.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
