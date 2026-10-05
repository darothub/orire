"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { usePlanStore } from "@/lib/store/planStore";
import { useUIStore } from "@/lib/store/uiStore";
import { devSetPlan, readEntitlement } from "@/app/actions/refine";
import { billingStatus, openBillingPortal, startCheckout, type BillingStatus } from "@/app/actions/billing";
import {
  subscriptionLine,
} from "@/lib/billing/summary";
import { canEmbedCheckout } from "@/lib/billing/stripe-client";
import { CheckoutModal } from "@/components/CheckoutModal";
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/plan/plan";

/**
 * Plan / subscription panel.
 *
 * When Stripe is configured (Phase B2), signed-in users subscribe to paid
 * plans via Checkout and manage/cancel through the Customer Portal — the
 * webhook writes the authoritative entitlement. When Stripe is NOT configured
 * (local dev with no billing keys) it falls back to B1's instant `devSetPlan`
 * so the gates can still be exercised end-to-end. Enforcement is server-side
 * either way; the usage shown here mirrors the Postgres counter when signed in.
 */
export function PlanPanel() {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const plan = usePlanStore((s) => s.plan);
  const setPlan = usePlanStore((s) => s.setPlan);
  const syncFromServer = usePlanStore((s) => s.syncFromServer);
  const openAuth = useUIStore((s) => s.openAuth);
  const used = usePlanStore((s) => s.usedThisMonth());

  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [busy, setBusy] = useState<PlanId | "portal" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null);

  const active = PLANS[plan];
  const cap = active.monthlyRefines;
  const pctUsed = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const useStripe = signedIn && billing?.configured === true;
  const subLine = billing ? subscriptionLine(billing) : null;

  // Load billing capability + reconcile entitlement when signed in. Also picks
  // up a return from Checkout (?billing=success) to refresh the mirror.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!signedIn) {
        if (!cancelled) setBilling(null);
        return;
      }
      const [b, ent] = await Promise.all([billingStatus(), readEntitlement()]);
      if (cancelled) return;
      setBilling(b);
      if (ent) syncFromServer({ plan: ent.plan, usedThisMonth: ent.usedThisMonth });
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const flag = params.get("billing");
        if (flag) {
          if (flag === "success") setNotice("Subscription active — welcome aboard.");
          else if (flag === "cancelled") setNotice("Checkout cancelled — no changes made.");
          else if (flag === "portal") setNotice("Billing updated.");
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

  const manage = async () => {
    setNotice(null);
    setBusy("portal");
    const r = await openBillingPortal();
    if (r.url) redirect(r.url);
    else {
      setNotice(r.error ?? "Could not open the billing portal.");
      setBusy(null);
    }
  };

  const pick = async (id: PlanId) => {
    setNotice(null);
    if (!signedIn) {
      // Paid plans require an account — you can't subscribe anonymously, and a
      // local-only switch would let an explorer unlock Pro/Career for free.
      // Push them into sign-up; they can subscribe once authenticated.
      if (id !== "free") {
        openAuth("signup");
        return;
      }
      setPlan(id);
      return;
    }
    if (useStripe) {
      if (id === "free") {
        // Downgrades are handled in the Customer Portal to keep Stripe in sync.
        if (billing?.hasSubscription) {
          await manage();
          return;
        }
        const r = await devSetPlan(id);
        if (r) syncFromServer({ plan: r.plan, usedThisMonth: r.usedThisMonth });
        return;
      }
      setBusy(id);
      if (canEmbedCheckout()) {
        // Embedded checkout — keep the user on an orire-branded page.
        setCheckoutPlan(id);
        setBusy(null);
        return;
      }
      // No publishable key configured: fall back to hosted Checkout redirect.
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

  return (
    <div className="plan-panel">
      <div className="plan-head">
        <span className="ed-label">Plan</span>
        <span className="conn-hint">
          {signedIn
            ? useStripe
              ? "Subscribe securely via Stripe. Manage or cancel anytime from the billing portal."
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
        {subLine && (
          <div className={`plan-subline${subLine.tone === "warn" ? " is-warn" : ""}`}>
            {subLine.text}
          </div>
        )}
        {useStripe && billing?.canManage && (
          <button className="plan-manage" onClick={() => void manage()} disabled={busy === "portal"}>
            {busy === "portal" ? "Opening…" : "Manage billing"}
          </button>
        )}
      </div>

      {checkoutPlan && (
        <CheckoutModal plan={checkoutPlan} onClose={() => setCheckoutPlan(null)} />
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
  onPick,
}: {
  id: PlanId;
  active: boolean;
  index: number;
  busy: boolean;
  useStripe: boolean;
  onPick: () => void;
}) {
  const p = PLANS[id];
  const cta = active ? "Current" : useStripe && id !== "free" ? "Subscribe" : "Select";
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
