"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/consent/consent";
import { funnel, type CtaPlacement } from "@/lib/analytics/funnel";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { CookiePreferencesLink } from "@/components/analytics/CookiePreferencesLink";
import { useUIStore } from "@/lib/store/uiStore";
import { BrandMark } from "@/components/BrandMark";
import { GapGauge } from "@/components/landing/GapGauge";
import { TailorTrio } from "@/components/landing/TailorTrio";
import dynamic from "next/dynamic";

// Keep the fictional demo in a separate client chunk instead of bundling its
// template-switching interaction into the critical landing route module.
// SSR remains enabled: HTML and page geometry are unchanged.
const LiveDemo = dynamic(() => import("@/components/landing/LiveDemo").then((m) => m.LiveDemo));
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { demoTemplates } from "@/components/landing/demo";
import { getTemplate } from "@/components/templates/registry";
import { landingCV } from "@/components/landing/landingCv";
import { TEMPLATE_COUNT } from "@/lib/templates/catalog";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Public, pre-auth landing page. Advertises the product and routes visitors
 * into the sign-in / sign-up modal (AuthOverlay). Reuses the signature drifting
 * CV showcase and the framer-motion aesthetic used throughout the app.
 */
export function Landing() {
  const openAuth = useUIStore((s) => s.openAuth);
  const setExplored = useUIStore((s) => s.setExplored);
  const { consent, ready } = useConsent();
  const reducedMotion = useReducedMotion();
  const reveal = (distance = 16, delay = 0, amount = 0.4) => ({
    initial: reducedMotion ? false as const : { opacity: 0, y: distance },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount },
    transition: { duration: reducedMotion ? 0 : 0.5, delay: reducedMotion ? 0 : delay, ease: EASE },
  });
  useEffect(() => {
    if (consent === "granted") funnel.landingViewed();
  }, [consent]);
  const startSignup = (placement: CtaPlacement, plan?: Parameters<typeof openAuth>[1]) => {
    funnel.landingCta(placement);
    openAuth("signup", plan);
  };

  return (
    <div className="landing">
      <div className="lx-ambient" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <a className="skip-to-main" href="#main-content">Skip to main content</a>

      <header className="landing-nav">
        <div className="landing-brand">
          <span className="landing-brand-mark"><BrandMark size={28} /></span>
          <span className="landing-brand-name">Orire</span>
          <span className="landing-brand-tag">AI CV Studio</span>
        </div>
        <div className="landing-nav-actions">
          <nav className="landing-nav-links" aria-label="Sections">
            <a href="#how">How it works</a>
            <a href="#templates">Templates</a>
            <a href="#demo">Live demo</a>
            <Link href="/pricing">Pricing</Link>
          </nav>
          <button className="landing-ghost" disabled={!ready} onClick={() => openAuth("signin")}>
            Sign in
          </button>
          <button className="landing-ghost landing-guest" disabled={!ready} onClick={() => setExplored(true)}>
            Try as guest
          </button>
          <button className="landing-cta landing-header-cta" disabled={!ready} aria-label="Get started" onClick={() => startSignup("header")}>
            <span className="landing-header-cta-long">Get started</span>
            <span className="landing-header-cta-short" aria-hidden="true">Start</span>
          </button>
          <LandingMobileNav interactiveReady={ready} />
        </div>
      </header>

      <main id="main-content" className="landing-main" tabIndex={-1}>
        <section className="landing-hero lx-hero">
          <div className="lx-hero-grid">
            {/* Primary message stays in server HTML; actions enable after hydration. */}
            <div className="lx-hero-copy">
              <span className="lx-pill"><i aria-hidden="true" />AI-powered CV studio</span>
              <h1 className="lx-title">
                Measure the gap to the job. <em>Then close it</em> — honestly.
              </h1>
              <p className="lx-sub">
                Paste a job description. Orire benchmarks your CV against a perfect-match candidate,
                interviews you for what&apos;s missing, and rewrites in the role&apos;s voice — without
                inventing a single fact.
              </p>
              <div className="lx-cta-row">
                <button className="lx-cta" disabled={!ready} onClick={() => startSignup("hero")}>
                  <span aria-hidden="true">✦</span> Create your CV with AI
                </button>
                <button className="lx-ghost" disabled={!ready} onClick={() => setExplored(true)}>
                  Try it as a guest
                </button>
              </div>
              <p className="lx-note">Free to start · No card required · Your first simulation is free</p>
              <p className="lx-trust">
                <span className="lx-faces" aria-hidden="true"><i /><i /><i /><i /></span>
                Trusted by job seekers worldwide
              </p>
            </div>
            <GapGauge />
          </div>
        </section>

        <section id="how" className="landing-section landing-how landing-how-compact" aria-label="How it works">
          <motion.div className="landing-motion-reveal landing-about-head" {...reveal()}>
            <span className="landing-eyebrow">Three instruments, one loop</span>
            <h2 className="landing-h2">Diagnose. Interview. Polish.</h2>
            <p className="landing-about-lead">Each stands alone. Run them in order for a guided path, or jump to the one you need.</p>
          </motion.div>
          <TailorTrio />
        </section>

        <section id="templates" className="landing-section landing-gallery" aria-labelledby="landing-gallery-heading">
          <div className="landing-about-head">
            <span className="landing-eyebrow">Designed for your next step</span>
            <h2 id="landing-gallery-heading" className="landing-h2">Explore real CV templates before signing up.</h2>
            <p className="landing-about-lead">
              See how three available Orire templates present the same fictional example CV.
              Choose a design that fits your experience, then make it your own.
            </p>
          </div>
          <div className="landing-gallery-grid">
            {demoTemplates().slice(0, 3).map((template) => (
              <article key={template.id} className="landing-gallery-card">
                {/* Full templates can contain anchors. Keep the decorative
                    snapshot inert and outside the card's navigation link. */}
                <div className="landing-gallery-art" style={{ background: template.swatch }} aria-hidden="true" inert>
                  <div className="landing-gallery-real-paper">
                    <div className="paper landing-gallery-template">
                      {(() => {
                        const Preview = getTemplate(template.id).Component;
                        return <Preview cv={landingCV} />;
                      })()}
                    </div>
                  </div>
                </div>
                <h3 className="landing-gallery-name">{template.name}</h3>
                <p className="landing-gallery-description">{template.blurb}</p>
                <Link className="landing-gallery-action" href={`/templates/${template.id}`}>
                  Preview {template.name} template →
                </Link>
              </article>
            ))}
          </div>
          <p className="landing-gallery-more"><Link href="/templates">View all {TEMPLATE_COUNT} templates →</Link></p>
        </section>

        <LiveDemo />

        <section className="landing-section landing-final">
          <motion.div
            className="landing-motion-reveal landing-final-card"
            {...reveal(20, 0, 0.5)}
          >
            <h2 className="landing-h2">Ready to let AI sharpen your CV?</h2>
            <p className="landing-final-sub">
              Start with your experience, choose a template, and refine your CV at your own pace.
            </p>
            <button className="landing-cta lg" disabled={!ready} onClick={() => startSignup("footer")}>
              Get started free
            </button>
          </motion.div>
        </section>

      </main>

      <footer className="landing-foot">
        <span className="landing-foot-mark">Orire</span>
        <span className="landing-foot-copy">
          © {new Date().getFullYear()} Orire · AI CV Studio
        </span>
        <span className="landing-foot-links">
          <Link href="/templates">Templates</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/guides">Guides</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/support">Support</Link>
          <CookiePreferencesLink />
        </span>
      </footer>
    </div>
  );
}
