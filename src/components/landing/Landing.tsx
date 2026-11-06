"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/consent/consent";
import { funnel, type CtaPlacement } from "@/lib/analytics/funnel";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { CookiePreferencesLink } from "@/components/analytics/CookiePreferencesLink";
import { useUIStore } from "@/lib/store/uiStore";
import { BrandMark } from "@/components/BrandMark";
import { AiStudioHero } from "@/components/landing/AiStudioHero";
import { landingPlans } from "@/components/landing/pricing";
import { howItWorksSteps } from "@/components/landing/howItWorks";
import { beforeAfterLines } from "@/components/landing/beforeAfter";
import dynamic from "next/dynamic";

// Keep the fictional demo in a separate client chunk instead of bundling its
// template-switching interaction into the critical landing route module.
// SSR remains enabled: HTML and page geometry are unchanged.
const LiveDemo = dynamic(() => import("@/components/landing/LiveDemo").then((m) => m.LiveDemo));
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { demoTemplates } from "@/components/landing/demo";
import { getTemplate } from "@/components/templates/registry";
import { sampleCV } from "@/lib/cv/sample";
import { TEMPLATE_COUNT } from "@/lib/templates/catalog";

const EASE = [0.22, 1, 0.36, 1] as const;

interface Feature {
  viz: "ring" | "brand" | "chips" | "compare" | "meter" | "grid";
  icon: string;
  title: string;
  body: string;
}

/** Product differentiators — the real capabilities, not filler. Simulate leads:
 *  it's what nothing else does. */
const FEATURES: Feature[] = [
  {
    icon: "◎",
    viz: "ring",
    title: "Explore simulated role-match guidance",
    body: "Explore a simulated role-match profile, compare it with your CV, and identify experience and wording you may want to highlight. The simulation is guidance, not an employer decision.",
  },
  {
    icon: "⟳",
    viz: "brand",
    title: "Re-brand any CV",
    body: "Upload a PDF or DOCX and Orire restructures it into a clean, out-of-this-world template — your facts, elegantly re-laid.",
  },
  {
    icon: "✦",
    viz: "chips",
    title: "Tailor to the job",
    body: "Paste a job description and refine your CV to match it — sharpened wording and ordering, never invented experience.",
  },
  {
    icon: "⟂",
    viz: "compare",
    title: "Compare, then pick the best",
    body: "Run two assistants in parallel, see them side by side, and let Orire pick the stronger draft — with the reasoning shown.",
  },
  {
    icon: "⚖",
    viz: "meter",
    title: "A clear CV score",
    body: "Use Orire’s internal writing-quality rubric to review changes. It is guidance, not an employer or ATS rating.",
  },
  {
    icon: "❖",
    viz: "grid",
    title: `${TEMPLATE_COUNT} standout templates`,
    body: "Explore distinct CV layouts, then see your changes in a live preview as you edit.",
  },
];

function FeatureViz({ kind }: { kind: Feature["viz"] }) {
  return (
    <div className={`lx-viz lx-viz-${kind}`} aria-hidden="true">
      {kind === "ring" && (
        <svg viewBox="0 0 64 64" width="72" height="72">
          <circle cx="32" cy="32" r="26" className="lx-ring-bg" />
          <circle cx="32" cy="32" r="26" className="lx-ring lx-ring-loop" strokeDasharray="163" />
        </svg>
      )}
      {kind === "brand" && <><i /><i /><i /><b /></>}
      {kind === "chips" && ["keywords", "tone", "order"].map((c) => <em key={c}>{c}</em>)}
      {kind === "compare" && <><span><i /></span><span><i /></span></>}
      {kind === "meter" && <span className="lx-meter"><i /></span>}
      {kind === "grid" && Array.from({ length: 6 }, (_, i) => <u key={i} />)}
    </div>
  );
}

/**
 * Public, pre-auth landing page. Advertises the product and routes visitors
 * into the sign-in / sign-up modal (AuthOverlay). Reuses the signature drifting
 * CV showcase and the framer-motion aesthetic used throughout the app.
 */
export function Landing() {
  const openAuth = useUIStore((s) => s.openAuth);
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
            <a href="#pricing">Pricing</a>
          </nav>
          <button className="landing-ghost" disabled={!ready} onClick={() => openAuth("signin")}>
            Sign in
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
                Let AI turn your experience into a CV that <em>stands out.</em>
              </h1>
              <p className="lx-sub">
                Orire reads the job, rewrites your wording to fit it, and lays it out in a
                designer template. Your facts stay yours. You approve every word.
              </p>
              <div className="lx-cta-row">
                <button className="lx-cta" disabled={!ready} onClick={() => startSignup("hero")}>
                  <span aria-hidden="true">✦</span> Create your CV with AI
                </button>
                <a className="lx-link" href="#templates">Explore templates<span aria-hidden="true"> →</span></a>
              </div>
              <p className="lx-note">Free to start · No card required</p>
            </div>
            <AiStudioHero />
          </div>
          <div className="lx-marquee" aria-hidden="true">
            <div className="lx-marquee-track">
              {[0, 1].map((k) => (
                <span key={k}>
                  <b>Tailor to any job</b><b>Role-match guidance</b><b>Rewrite weak bullets</b>
                  <b>{TEMPLATE_COUNT} templates</b><b>PDF &amp; DOCX in</b><b>Side-by-side assistants</b>
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="landing-section landing-how landing-how-compact" aria-label="How it works">
          <motion.div
            className="landing-motion-reveal landing-about-head"
            {...reveal()}
          >
            <span className="landing-eyebrow">How it works</span>
            <h2 className="landing-h2">Three simple steps to a stronger CV</h2>
          </motion.div>
          <ol className="landing-steps">
            {howItWorksSteps().map((step, i) => (
              <motion.li
                key={step.n}
                className="landing-motion-reveal landing-step"
                {...reveal(18, i * 0.08, 0.3)}
              >
                <span className="lx-step-badge" aria-hidden>{step.icon}</span>
                <span className="landing-step-n" aria-hidden>{String(step.n).padStart(2, "0")}</span>
                <h3 className="landing-step-title">{["Add your details", "Refine with AI", "Download your CV"][i]}</h3>
                <p className="landing-step-body">{step.body}</p>
              </motion.li>
            ))}
          </ol>
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
                        return <Preview cv={sampleCV} />;
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

        <section className="landing-section landing-ba" aria-label="Before and after writing examples">
          <motion.div
            className="landing-motion-reveal landing-about-head"
            {...reveal()}
          >
            <span className="landing-eyebrow">Same facts, sharper story</span>
            <h2 className="landing-h2">See how clearer writing strengthens your experience.</h2>
            <p className="landing-about-lead">
              Orire never invents experience — it re-frames what you already did
              into outcome-led lines a recruiter can&apos;t skim past. The
              before/after examples are illustrative; you provide the real figures.
            </p>
          </motion.div>
          <ul className="landing-ba-list">
            {beforeAfterLines().map((line, i) => (
              <motion.li
                key={line.after}
                className="landing-motion-reveal landing-ba-row" tabIndex={0}
                {...reveal(16, i * 0.08, 0.3)}
              >
                <span className="landing-ba-before">
                  <span className="landing-ba-tag" aria-hidden>Before</span>
                  {line.before}
                </span>
                <span className="landing-ba-arrow" aria-hidden>→</span>
                <span className="landing-ba-after">
                  <span className="landing-ba-tag" aria-hidden>After</span>
                  {line.after}
                </span>
              </motion.li>
            ))}
          </ul>
        </section>

        <section className="landing-section landing-features" aria-label="Features">
          <motion.h2
            className="landing-motion-reveal landing-h2"
            {...reveal()}
          >
            Tools to help you create a confident, professional CV
          </motion.h2>
          <div className="landing-grid">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                className="landing-motion-reveal landing-card"
                {...reveal(18, (i % 3) * 0.08, 0.3)}
              >
                <span className="landing-card-icon" aria-hidden>{f.icon}</span>
                <h3 className="landing-card-title">{f.title}</h3>
                <p className="landing-card-body">{f.body}</p>
                <FeatureViz kind={f.viz} />
              </motion.div>
            ))}
          </div>
        </section>

        <LiveDemo />

        <section id="pricing" className="landing-section landing-pricing" aria-label="Pricing">
          <motion.div
            className="landing-motion-reveal landing-about-head"
            {...reveal()}
          >
            <span className="landing-eyebrow">Simple, honest pricing</span>
            <h2 className="landing-h2">Start free. Choose a plan when you need more.</h2>
            <p className="landing-about-lead">
              Prices are in US dollars (USD). Paid plans renew monthly.
              Orire includes managed AI usage—no separate AI API key required.
            </p>
          </motion.div>
          <div className="landing-price-grid">
            {landingPlans().map((p, i) => (
              <motion.div
                key={p.id}
                className={`landing-motion-reveal landing-price-card${p.highlighted ? " is-featured" : ""}`}
                {...reveal(18, i * 0.08, 0.3)}
              >
                {p.highlighted && <span className="landing-price-badge">Recommended</span>}
                <h3 className="landing-price-name">{p.label}</h3>
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
                <button
                  className={p.highlighted ? "landing-cta" : "landing-ghost"}
                  disabled={!ready}
                  onClick={() => startSignup("pricing", p.id)}
                >
                  {p.cta}
                </button>
              </motion.div>
            ))}
          </div>
          <p className="landing-pricing-disclosure">Paid subscriptions renew monthly in USD until cancelled. Cancel through billing settings; access generally continues until the current paid period ends. Applicable taxes, if any, are shown during checkout before payment. Free quotas are lifetime totals, not monthly allowances.</p>
        </section>

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
