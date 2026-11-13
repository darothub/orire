"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { AuthOverlay } from "@/components/auth/AuthOverlay";
import { BrandMark } from "@/components/BrandMark";
import { landingPlans } from "@/components/landing/pricing";
import { funnel } from "@/lib/analytics/funnel";
import { useUIStore } from "@/lib/store/uiStore";

/** Public pricing page. Plan buttons open sign-up with the chosen plan; signed-in users go to the app. */
export function PricingView() {
  const openAuth = useUIStore((s) => s.openAuth);
  const { status } = useSession();
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link href="/" className="landing-brand" aria-label="Orire home">
          <span className="landing-brand-mark"><BrandMark size={28} /></span>
          <span className="landing-brand-name">Orire</span>
        </Link>
        <div className="landing-nav-actions">
          <Link className="landing-ghost" href="/">← Back to Orire</Link>
        </div>
      </header>
      <main id="main-content">
        <section id="pricing" className="landing-section landing-pricing" aria-label="Pricing">
          <div className="landing-about-head">
            <span className="landing-eyebrow">Simple, honest pricing</span>
            <h1 className="landing-h2">Start free. Choose a plan when you need more.</h1>
            <p className="landing-about-lead">
              Prices are in US dollars (USD). Paid plans renew monthly.
              Orire includes managed AI usage—no separate AI API key required.
            </p>
          </div>
          <div className="landing-price-grid">
            {landingPlans().map((p) => (
              <div key={p.id} className={`landing-price-card${p.highlighted ? " is-featured" : ""}`}>
                {p.highlighted && <span className="landing-price-badge">Recommended</span>}
                <h2 className="landing-price-name">{p.label}</h2>
                <div className="landing-price-amt">
                  <span className="landing-price-num">{p.priceLabel}</span>
                  <span className="landing-price-cad">{p.cadence}</span>
                </div>
                <p className="landing-price-blurb">{p.blurb}</p>
                <p className="landing-price-usage-title">Usage limits</p>
                <ul className="landing-price-usage" aria-label={`${p.label} usage limits`}>
                  {p.usageDetails.map((detail) => <li key={detail}>{detail}</li>)}
                </ul>
                <ul className="landing-price-perks">
                  {p.perks.map((perk) => (
                    <li key={perk}><span aria-hidden>✓</span> {perk}</li>
                  ))}
                </ul>
                {status === "authenticated" ? (
                  <Link className={p.highlighted ? "landing-cta" : "landing-ghost"} href="/">Open workspace</Link>
                ) : (
                  <button
                    className={p.highlighted ? "landing-cta" : "landing-ghost"}
                    onClick={() => {
                      funnel.landingCta("pricing");
                      openAuth("signup", p.id);
                    }}
                  >
                    {p.cta}
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="landing-pricing-disclosure">Paid subscriptions renew monthly in USD until cancelled. Cancel through billing settings; access generally continues until the current paid period ends. Applicable taxes, if any, are shown during checkout before payment. Free quotas are lifetime totals, not monthly allowances.</p>
        </section>
      </main>
      <footer className="landing-foot">
        <span className="landing-foot-mark">Orire</span>
        <span className="landing-foot-links">
          <Link href="/templates">Templates</Link>
          <Link href="/guides">Guides</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/support">Support</Link>
        </span>
      </footer>
      <AuthOverlay />
    </div>
  );
}
