"use client";

import Link from "next/link";
import { landingPlans, type LandingPlan } from "@/components/landing/pricing";
import { CheckIcon } from "@/components/landing/icons";
import { Reveal } from "@/components/landing/Reveal";

/**
 * The plan cards shared by the landing teaser and /pricing, so both always show
 * the same plans, limits and wording (all derived from the plan policy).
 * `perkLimit` shortens the perk list for the teaser; /pricing shows them all.
 */
export function PlanCards({
  onChoose,
  disabled = false,
  signedIn = false,
  perkLimit,
}: {
  onChoose: (plan: LandingPlan) => void;
  disabled?: boolean;
  signedIn?: boolean;
  perkLimit?: number;
}) {
  return (
    <div className="lp-plans">
      {landingPlans().map((p) => {
        const btn = `lp-btn ${p.highlighted ? "lp-btn--gold" : "lp-btn--ghost"}`;
        return (
          <Reveal key={p.id} className={`lp-plan${p.highlighted ? " is-hot" : ""}`}>
            {p.highlighted && <span className="lp-plan-tag">Most popular</span>}
            <h3>{p.label}</h3>
            <div className="lp-price">{p.priceLabel}<span>{p.cadence}</span></div>
            <p className="lp-plan-blurb">{p.blurb}</p>
            <ul className="lp-usage" aria-label={`${p.label} usage limits`}>
              {p.usageDetails.map((detail) => <li key={detail}><CheckIcon />{detail}</li>)}
            </ul>
            <ul>
              {(perkLimit ? p.perks.slice(0, perkLimit) : p.perks).map((perk) => <li key={perk}><CheckIcon />{perk}</li>)}
            </ul>
            {signedIn ? (
              <Link className={btn} href="/">Open workspace</Link>
            ) : (
              <button className={btn} disabled={disabled} onClick={() => onChoose(p)}>{p.cta}</button>
            )}
          </Reveal>
        );
      })}
    </div>
  );
}
