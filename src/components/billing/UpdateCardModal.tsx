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
import { createCardSetupIntent, setDefaultPaymentMethod } from "@/app/actions/billing";

/**
 * Update the card on file — a SetupIntent collected through the Payment
 * Element, then set as the default for the customer and their subscription.
 * Card data goes directly to Stripe; we only receive the resulting payment
 * method id, whose ownership we re-verify server-side before trusting it.
 */
export function UpdateCardModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await createCardSetupIntent();
      if (cancelled) return;
      if (r.clientSecret) setClientSecret(r.clientSecret);
      else setError(r.error ?? "Could not start a card update.");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
          aria-label="Update payment method"
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="checkout-head">
            <div className="checkout-title">
              <span className="checkout-eyebrow">Billing</span>
              <strong>Update card</strong>
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
                <UpdateCardForm onDone={onDone} onError={setError} />
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

function UpdateCardForm({
  onDone,
  onError,
}: {
  onDone: () => void;
  onError: (msg: string) => void;
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
    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: `${origin}/?billing=card` },
      redirect: "if_required",
    });

    if (error) {
      setErr(error.message ?? "Could not save the card.");
      setBusy(false);
      return;
    }

    const pmId =
      typeof setupIntent?.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent?.payment_method?.id ?? null;
    if (!pmId) {
      setErr("Card saved, but no payment method was returned. Try again.");
      setBusy(false);
      return;
    }

    const r = await setDefaultPaymentMethod(pmId);
    if (r.error) {
      onError(r.error);
      setBusy(false);
      return;
    }
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
        {busy ? "Saving…" : "Save card"}
      </button>
    </form>
  );
}
