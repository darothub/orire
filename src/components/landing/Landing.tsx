"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/consent/consent";
import { funnel, type CtaPlacement } from "@/lib/analytics/funnel";
import Link from "next/link";
import dynamic from "next/dynamic";
import { CookiePreferencesLink } from "@/components/analytics/CookiePreferencesLink";
import { useUIStore } from "@/lib/store/uiStore";
import { BrandMark } from "@/components/BrandMark";
import { GapGauge } from "@/components/landing/GapGauge";
import { TailorTrio } from "@/components/landing/TailorTrio";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { employerLogos } from "@/components/landing/logos";
import { landingPlans } from "@/components/landing/pricing";
import { promises } from "@/components/landing/promises";
import "./landing.css";

// Keep the fictional demo in a separate client chunk instead of bundling its
// template-switching interaction into the critical landing route module.
// SSR remains enabled: HTML and page geometry are unchanged.
const LiveDemo = dynamic(() => import("@/components/landing/LiveDemo").then((m) => m.LiveDemo));

// Decorative glyphs for the promises band, in the same order as promises().
const PROMISE_GLYPHS = ["✦", "◎", "⇄", "◱"];
// Teasers show the first few perks; /pricing carries the complete list.
const TEASER_PERKS = 4;

/**
 * Public, pre-auth landing page (Ink + Fortune). Advertises the product and
 * routes visitors into the sign-in / sign-up modal (AuthOverlay). All claims
 * come from reviewable data modules (promises, logos, plan policy) so the page
 * cannot drift from what the product actually does and charges.
 */
export function Landing() {
  const openAuth = useUIStore((s) => s.openAuth);
  const setExplored = useUIStore((s) => s.setExplored);
  const { consent, ready } = useConsent();
  useEffect(() => {
    if (consent === "granted") funnel.landingViewed();
  }, [consent]);
  const startSignup = (placement: CtaPlacement, plan?: Parameters<typeof openAuth>[1]) => {
    funnel.landingCta(placement);
    openAuth("signup", plan);
  };

  return (
    <div className="lp">
      <div className="lp-ambient" aria-hidden="true"><i /><i /><i /></div>
      <a className="skip-to-main" href="#main-content">Skip to main content</a>

      <header className="lp-nav">
        <div className="lp-nav-in">
          <div className="lp-brand">
            <BrandMark size={30} />
            <b>Orire</b>
            <small>AI CV Studio</small>
          </div>
          <nav className="lp-links" aria-label="Sections">
            <a href="#how">How it works</a>
            <Link href="/templates">Templates</Link>
            <a href="#demo">Live demo</a>
            <Link href="/pricing">Pricing</Link>
          </nav>
          <div className="lp-actions">
            <button className="lp-btn lp-btn--ghost lp-btn--sm lp-signin" disabled={!ready} onClick={() => openAuth("signin")}>
              Sign in
            </button>
            <button className="lp-btn lp-btn--ghost lp-btn--sm lp-guest" disabled={!ready} onClick={() => setExplored(true)}>
              Try as guest
            </button>
            <button className="lp-btn lp-btn--primary lp-btn--sm lp-header-cta" disabled={!ready} aria-label="Get started" onClick={() => startSignup("header")}>
              <span className="lp-cta-long">Get started</span>
              <span className="lp-cta-short" aria-hidden="true">Start</span>
            </button>
            <LandingMobileNav interactiveReady={ready} />
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-grid">
            {/* Primary message stays in server HTML; actions enable after hydration. */}
            <div className="lp-hero-copy">
              <span className="lp-pill"><i aria-hidden="true" />AI-powered CV studio</span>
              <h1 className="lp-title">
                Measure the gap to the job. <em>Then close it</em>, honestly.
              </h1>
              <p className="lp-sub">
                Paste a job description. Orire benchmarks your CV against a perfect-match candidate,
                interviews you for what&apos;s missing, and rewrites in the role&apos;s voice, without
                inventing a single fact.
              </p>
              <div className="lp-cta-row">
                <button className="lp-btn lp-btn--primary lp-btn--lg" disabled={!ready} onClick={() => startSignup("hero")}>
                  <span aria-hidden="true">✦</span> Create your CV with AI
                </button>
                <button className="lp-btn lp-btn--ghost lp-btn--lg" disabled={!ready} onClick={() => setExplored(true)}>
                  Try it as a guest
                </button>
              </div>
              <p className="lp-note">Free to start · No card required · Your first simulation is free</p>
              <p className="lp-trust">
                <span className="lp-faces" aria-hidden="true"><i /><i /><i /><i /></span>
                Trusted by job seekers worldwide
              </p>
            </div>
            <GapGauge />
          </div>
        </section>

        <section className="lp-employers" aria-label="Target employers">
          <div className="lp-wrap">
            <p>Roles our users aim for, at teams like these. Employers shown are targets, not customers or endorsers.</p>
            <ul>
              {employerLogos().map((name) => <li key={name}>{name}</li>)}
            </ul>
          </div>
        </section>

        <section id="how" className="lp-section" aria-label="How it works">
          <div className="lp-wrap">
            <div className="lp-head">
              <span className="lp-eyebrow">Three instruments, one loop</span>
              <h2 className="lp-h2">Diagnose. Interview. Polish.</h2>
              <p className="lp-lead">Each stands alone. Run them in order for a guided path, or jump to the one you need.</p>
            </div>
            <TailorTrio />
          </div>
        </section>

        <LiveDemo />

        <section id="trust" className="lp-section" aria-label="Why you can trust it">
          <div className="lp-wrap">
            <div className="lp-head">
              <span className="lp-eyebrow">Why you can trust it</span>
              <h2 className="lp-h2">It elevates your facts. It never invents them.</h2>
            </div>
            <div className="lp-band">
              {promises().map((p, i) => (
                <div key={p.title} className="lp-cell">
                  <div className="lp-cell-ic" aria-hidden="true">{PROMISE_GLYPHS[i] ?? "✦"}</div>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="plans" className="lp-section" aria-label="Plans">
          <div className="lp-wrap">
            <div className="lp-head">
              <span className="lp-eyebrow">Pricing</span>
              <h2 className="lp-h2">Start free. Upgrade when the hunt gets serious.</h2>
            </div>
            <div className="lp-plans">
              {landingPlans().map((p) => (
                <div key={p.id} className={`lp-plan${p.highlighted ? " is-hot" : ""}`}>
                  {p.highlighted && <span className="lp-plan-tag">Recommended</span>}
                  <h3>{p.label}</h3>
                  <div className="lp-price">{p.priceLabel}<span>{p.cadence}</span></div>
                  <p className="lp-plan-blurb">{p.blurb}</p>
                  <ul className="lp-usage" aria-label={`${p.label} usage limits`}>
                    {p.usageDetails.map((detail) => <li key={detail}>{detail}</li>)}
                  </ul>
                  <ul>
                    {p.perks.slice(0, TEASER_PERKS).map((perk) => <li key={perk}>{perk}</li>)}
                  </ul>
                  <button
                    className={`lp-btn ${p.highlighted ? "lp-btn--gold" : "lp-btn--ghost"}`}
                    disabled={!ready}
                    onClick={() => startSignup("pricing", p.id)}
                  >
                    {p.cta}
                  </button>
                </div>
              ))}
            </div>
            <p className="lp-plans-more">
              Prices in USD; paid plans renew monthly and free quotas are lifetime totals.{" "}
              <Link href="/pricing">See every feature and the full terms</Link>
            </p>
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-wrap">
            <div className="lp-final-card">
              <h2>Ready to let AI sharpen your CV?</h2>
              <p>Start with your experience, choose a template, and refine your CV at your own pace.</p>
              <button className="lp-btn lp-btn--gold lp-btn--lg" disabled={!ready} onClick={() => startSignup("footer")}>
                Get started free
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-in">
          <b>Orire</b>
          <span>© {new Date().getFullYear()} Orire · AI CV Studio</span>
          <span className="lp-foot-links">
            <Link href="/templates">Templates</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/guides">Guides</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/support">Support</Link>
            <CookiePreferencesLink />
          </span>
        </div>
      </footer>
    </div>
  );
}
