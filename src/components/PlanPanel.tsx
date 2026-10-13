"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { usePlanStore } from "@/lib/store/planStore";
import { useUIStore } from "@/lib/store/uiStore";
import { analytics } from "@/lib/analytics/events";
import { devSetPlan, readEntitlement } from "@/app/actions/refine";
import {
  billingDetail,
  cancelSubscription,
  resumeSubscription,
  startCheckout,
  switchPlan,
  type BillingDetail,
} from "@/app/actions/billing";
import { subscriptionLine, formatBillingDate } from "@/lib/billing/summary";
import { canEmbedCheckout } from "@/lib/billing/stripe-client";
import { CheckoutModal } from "@/components/CheckoutModal";
import { UpdateCardModal } from "@/components/billing/UpdateCardModal";
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/plan/plan";

/**
 * Plan / subscription panel.
 *
 * When Stripe is configured, signed-in users subscribe, switch, cancel and
 * update their card entirely inside orire — the custom Payment Element form and
 * this billing panel stand in for Stripe-hosted Checkout and the Customer
 * Portal. The webhook remains the authoritative writer of the entitlement.
 * When Stripe is NOT configured (local dev), it falls back to the instant
 * `devSetPlan` switch so the gates can still be exercised end-to-end.
 */
export function PlanPanel() {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const plan = usePlanStore((s) => s.plan);
  const setPlan = usePlanStore((s) => s.setPlan);
  const syncFromServer = usePlanStore((s) => s.syncFromServer);
  const openAuth = useUIStore((s) => s.openAuth);
  const used = usePlanStore((s) => s.usedThisMonth());

  const [billing, setBilling] = useState<BillingDetail | null>(null);
  const [busy, setBusy] = useState<PlanId | "cancel" | "resume" | "card" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const active = PLANS[plan];
  const cap = active.monthlyRefines;
  const pctUsed = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const useStripe = signedIn && billing?.configured === true;
  const subLine = billing ? subscriptionLine(billing) : null;

  // Pull the full billing detail + reconcile entitlement when signed in.
  const refresh = async () => {
    const [b, ent] = await Promise.all([billingDetail(), readEntitlement()]);
    setBilling(b);
    if (ent) syncFromServer({ plan: ent.plan, usedThisMonth: ent.usedThisMonth });
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!signedIn) {
        if (!cancelled) setBilling(null);
        return;
      }
      const [b, ent] = await Promise.all([billingDetail(), readEntitlement()]);
      if (cancelled) return;
      setBilling(b);
      if (ent) syncFromServer({ plan: ent.plan, usedThisMonth: ent.usedThisMonth });
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const flag = params.get("billing");
        if (flag) {
          if (flag === "success") setNotice("Subscription active — welcome aboard.");
          else if (flag === "cancelled") setNotice("Checkout cancelled — no changes made.");
          else if (flag === "processing") setNotice("Finishing up your subscription…");
          else if (flag === "card") setNotice("Card updated.");
          params.delete("billing");
          const qs = params.toString();
          window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, syncFromServer]);

  const redirect = (url: string) => {
    if (typeof window !== "undefined") window.location.assign(url);
  };

  const doCancel = async () => {
    setNotice(null);
    setBusy("cancel");
    const r = await cancelSubscription();
    if (r.ok) {
      await refresh();
      const end = formatBillingDate(billing?.renewsAt ?? null);
      setNotice(end ? `Cancellation scheduled — access continues until ${end}.` : "Cancellation scheduled.");
    } else {
      setNotice(r.error ?? "Could not cancel.");
    }
    setConfirmingCancel(false);
    setBusy(null);
  };

  const doResume = async () => {
    setNotice(null);
    setBusy("resume");
    const r = await resumeSubscription();
    if (r.ok) {
      await refresh();
      setNotice("Subscription resumed — your plan will keep renewing.");
    } else {
      setNotice(r.error ?? "Could not resume.");
    }
    setBusy(null);
  };

  const onCardUpdated = async () => {
    setCardOpen(false);
    setNotice("Card updated.");
    await refresh();
  };

  const pick = async (id: PlanId) => {
    setNotice(null);
    if (!signedIn) {
      // Paid plans require an account — push anonymous users into sign-up.
      if (id !== "free") {
        analytics.paywallSignupPrompt(id);
        openAuth("signup");
        return;
      }
      setPlan(id);
      return;
    }

    if (useStripe) {
      if (id === plan) return; // already on this plan

      if (id === "free") {
        // Downgrade to Free = cancel at period end (keeps access until then).
        if (billing?.hasSubscription) {
          await doCancel();
        }
        return;
      }

      // Paid plan.
      if (billing?.hasSubscription) {
        // Already subscribed → switch plan with proration, no re-entry of card.
        setBusy(id);
        const r = await switchPlan(id);
        if (r.ok) {
          await refresh();
          setNotice(`Switched to ${PLANS[id].label}.`);
        } else {
          setNotice(r.error ?? "Could not change your plan.");
        }
        setBusy(null);
        return;
      }

      // New subscription.
      if (canEmbedCheckout()) {
        analytics.checkoutStarted(id, "embedded");
        setCheckoutPlan(id);
        return;
      }
      // No publishable key → fall back to hosted Checkout redirect.
      setBusy(id);
      analytics.checkoutStarted(id, "hosted");
      const r = await startCheckout(id);
      if (r.url) redirect(r.url);
      else {
        setNotice(r.error ?? "Could not start checkout.");
        setBusy(null);
      }
      return;
    }

    // Dev fallback (Stripe not configured): instant plan switch.
    const r = await devSetPlan(id);
    if (r) syncFromServer({ plan: r.plan, usedThisMonth: r.usedThisMonth });
  };

  const cardLabel = billing?.card
    ? `${(billing.card.brand ?? "card").replace(/\b\w/, (c) => c.toUpperCase())} •••• ${billing.card.last4 ?? "····"}`
    : null;

  return (
    <div className="plan-panel">
      <div className="plan-head">
        <span className="ed-label">Plan</span>
        <span className="conn-hint">
          {signedIn
            ? useStripe
              ? "Subscribe, switch, cancel or update your card right here — no redirects."
              : "Switch instantly to try each tier’s limits — enforced server-side against your account."
            : "Sign in to save your plan. Switching here is a local trial until you do."}
          {" "}Premium models are included on Career; Free and Pro run on budget and mid-tier
          models — that’s what keeps the flat price sustainable.
        </span>
      </div>

      <div className="plan-grid">
        {PLAN_ORDER.map((id, i) => (
          <PlanCard
            key={id}
            id={id}
            active={id === plan}
            index={i}
            busy={busy === id}
            useStripe={useStripe}
            hasSubscription={Boolean(billing?.hasSubscription)}
            onPick={() => void pick(id)}
          />
        ))}
      </div>

      {notice && <div className="plan-notice" role="status">{notice}</div>}

      <div className="plan-usage">
        <div className="plan-usage-row">
          <span className="ed-label">This month</span>
          <span className="plan-usage-count">
            {cap === null ? `${used} refines · unlimited` : `${used} / ${cap} refines`}
          </span>
        </div>
        {cap !== null && (
          <div className="plan-bar" aria-hidden>
            <motion.span
              className="plan-bar-fill"
              initial={false}
              animate={{ width: `${pctUsed}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 26 }}
            />
          </div>
        )}

        {/* Custom in-app billing management (replaces the Stripe Customer Portal). */}
        {useStripe && billing?.hasSubscription && (
          <div className="billing-manage">
            {billing.cancelAtPeriodEnd ? (
              <div className="plan-subline is-warn">
                {(() => {
                  const end = formatBillingDate(billing.renewsAt);
                  return end ? `Cancels on ${end} — you keep access until then.` : "Cancellation scheduled.";
                })()}
              </div>
            ) : (
              subLine && (
                <div className={`plan-subline${subLine.tone === "warn" ? " is-warn" : ""}`}>
                  {subLine.text}
                </div>
              )
            )}

            <div className="billing-card-row">
              <span className="billing-card-label">
                {cardLabel ? `Card on file: ${cardLabel}` : "No card on file"}
              </span>
              <button
                className="billing-link"
                onClick={() => setCardOpen(true)}
                disabled={busy === "card"}
              >
                Update card
              </button>
            </div>

            {billing.cancelAtPeriodEnd ? (
              <div className="billing-actions">
                <button className="billing-btn" onClick={() => void doResume()} disabled={busy === "resume"}>
                  {busy === "resume" ? "Resuming…" : "Resume subscription"}
                </button>
              </div>
            ) : confirmingCancel ? (
              <div className="billing-confirm" role="group" aria-label="Confirm cancellation">
                <p className="billing-confirm-q">
                  {(() => {
                    const end = formatBillingDate(billing.renewsAt);
                    return end
                      ? `Cancel your subscription? You’ll keep ${PLANS[plan].label} access until ${end}, then move to Free. No further charges.`
                      : "Cancel your subscription? You’ll keep access until the end of the current period, then move to Free.";
                  })()}
                </p>
                <div className="billing-actions">
                  <button
                    className="billing-btn"
                    onClick={() => setConfirmingCancel(false)}
                    disabled={busy === "cancel"}
                  >
                    Keep subscription
                  </button>
                  <button
                    className="billing-btn is-danger"
                    onClick={() => void doCancel()}
                    disabled={busy === "cancel"}
                  >
                    {busy === "cancel" ? "Cancelling…" : "Yes, cancel"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="billing-actions billing-actions-col">
                <button
                  className="billing-btn is-danger"
                  onClick={() => setConfirmingCancel(true)}
                >
                  Cancel subscription
                </button>
                <span className="billing-fineprint">
                  Cancel any time — no lock-in. You keep access until the end of the period you’ve paid for.
                </span>
              </div>
            )}
          </div>
        )}

        {/* No active subscription but a status worth surfacing (e.g. past_due). */}
        {useStripe && !billing?.hasSubscription && subLine && (
          <div className={`plan-subline${subLine.tone === "warn" ? " is-warn" : ""}`}>
            {subLine.text}
          </div>
        )}
      </div>

      {checkoutPlan && (
        <CheckoutModal plan={checkoutPlan} onClose={() => setCheckoutPlan(null)} />
      )}

      {cardOpen && (
        <UpdateCardModal onClose={() => setCardOpen(false)} onDone={() => void onCardUpdated()} />
      )}
    </div>
  );
}

function PlanCard({
  id,
  active,
  index,
  busy,
  useStripe,
  hasSubscription,
  onPick,
}: {
  id: PlanId;
  active: boolean;
  index: number;
  busy: boolean;
  useStripe: boolean;
  hasSubscription: boolean;
  onPick: () => void;
}) {
  const p = PLANS[id];
  const cta = active
    ? "Current"
    : !useStripe
      ? "Select"
      : id === "free"
        ? hasSubscription
          ? "Cancel"
          : "Select"
        : hasSubscription
          ? "Switch"
          : "Subscribe";
  return (
    <motion.button
      className={`plan-card${active ? " is-active" : ""}`}
      onClick={onPick}
      aria-pressed={active}
      disabled={busy}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
    >
      <div className="plan-card-head">
        <strong>{p.label}</strong>
        <span className="plan-price">{p.price === 0 ? "Free" : `$${p.price}`}<em>{p.price ? "/mo" : ""}</em></span>
      </div>
      <span className="plan-blurb">{p.blurb}</span>
      <ul className="plan-perks">
        {p.perks.map((perk) => (
          <li key={perk}>{perk}</li>
        ))}
      </ul>
      <span className="plan-cta">{busy ? "…" : cta}</span>
      {active && (
        <motion.span layoutId="plan-ring" className="plan-ring" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
      )}
    </motion.button>
  );
}
