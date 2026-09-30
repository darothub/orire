"use client";

import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { usePlanStore } from "@/lib/store/planStore";
import { devSetPlan } from "@/app/actions/refine";
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/plan/plan";

/**
 * Plan / subscription panel. In this local build switching a plan is instant
 * (no billing) so the entitlement gates — compare, model tiers, monthly cap —
 * can be exercised end-to-end. Enforcement is server-side (Phase B1): when
 * signed in, a plan switch goes through the `devSetPlan` action and the usage
 * shown here mirrors the Postgres counter; signed out, it's a local trial.
 */
export function PlanPanel() {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const plan = usePlanStore((s) => s.plan);
  const setPlan = usePlanStore((s) => s.setPlan);
  const syncFromServer = usePlanStore((s) => s.syncFromServer);
  const used = usePlanStore((s) => s.usedThisMonth());

  const active = PLANS[plan];
  const cap = active.monthlyRefines;
  const pctUsed = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;

  const pick = async (id: PlanId) => {
    if (signedIn) {
      const r = await devSetPlan(id);
      if (r) syncFromServer({ plan: r.plan, usedThisMonth: r.usedThisMonth });
    } else {
      setPlan(id);
    }
  };

  return (
    <div className="plan-panel">
      <div className="plan-head">
        <span className="ed-label">Plan</span>
        <span className="conn-hint">
          {signedIn
            ? "Switch instantly to try each tier’s limits — enforced server-side against your account."
            : "Sign in to save your plan. Switching here is a local trial until you do."}
          {" "}Premium models stay behind your own key on Free/Pro/Career — that’s what keeps the
          flat price sustainable.
        </span>
      </div>

      <div className="plan-grid">
        {PLAN_ORDER.map((id, i) => (
          <PlanCard key={id} id={id} active={id === plan} index={i} onPick={() => void pick(id)} />
        ))}
      </div>

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
      </div>
    </div>
  );
}

function PlanCard({
  id,
  active,
  index,
  onPick,
}: {
  id: PlanId;
  active: boolean;
  index: number;
  onPick: () => void;
}) {
  const p = PLANS[id];
  return (
    <motion.button
      className={`plan-card${active ? " is-active" : ""}`}
      onClick={onPick}
      aria-pressed={active}
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
      {active && (
        <motion.span layoutId="plan-ring" className="plan-ring" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
      )}
    </motion.button>
  );
}
