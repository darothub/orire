"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { AuthOverlay } from "@/components/auth/AuthOverlay";
import { BrandMark } from "@/components/BrandMark";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { PlanCards } from "@/components/landing/PlanCards";
import { funnel } from "@/lib/analytics/funnel";
import { useUIStore } from "@/lib/store/uiStore";
import "./landing.css";

/**
 * Public pricing page: the full version of the landing's plan section, built
 * from the same cards. Plan buttons open sign-up with the chosen plan; signed-in
 * users go to the app.
 */
export function PricingView() {
  const openAuth = useUIStore((s) => s.openAuth);
  const { status } = useSession();
  return (
    <div className="lp">
      <div className="lp-ambient" aria-hidden="true"><i /><i /></div>
      <a className="skip-to-main" href="#main-content">Skip to main content</a>
      <header className="lp-nav">
        <div className="lp-nav-in">
          <Link href="/" className="lp-brand" aria-label="Orire home">
            <BrandMark size={28} badge={false} />
            <b>Orire</b>
          </Link>
          <div className="lp-actions">
            <Link className="lp-btn lp-btn--ghost lp-btn--sm" href="/">← Back to Orire</Link>
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section id="pricing" className="lp-pricing" aria-label="Pricing">
          <div className="lp-wrap">
            <div className="lp-eyebrow">Simple, honest pricing</div>
            <h1 className="lp-h2 lp-h1">Start free. Choose a plan when you need more.</h1>
            <p className="lp-psub">
              Prices are in US dollars (USD). Paid plans renew monthly.
              Orire includes managed AI usage, no separate AI API key required.
            </p>
            <PlanCards
              signedIn={status === "authenticated"}
              onChoose={(p) => {
                funnel.landingCta("pricing");
                openAuth("signup", p.id);
              }}
            />
            <p className="lp-plans-more lp-disclosure">
              Paid subscriptions renew monthly in USD until cancelled. Cancel through billing settings; access
              generally continues until the current paid period ends. Applicable taxes, if any, are shown during
              checkout before payment. Free quotas are lifetime totals, not monthly allowances.
            </p>
          </div>
        </section>
      </main>
      <LandingFooter />
      <AuthOverlay />
    </div>
  );
}
