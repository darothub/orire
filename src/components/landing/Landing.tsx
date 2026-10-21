"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { CookiePreferencesLink } from "@/components/analytics/CookiePreferencesLink";
import { useUIStore } from "@/lib/store/uiStore";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { CvShowcase } from "@/components/landing/CvShowcase";
import { landingPlans } from "@/components/landing/pricing";
import { howItWorksSteps } from "@/components/landing/howItWorks";
import { trustStats } from "@/components/landing/trust";
import { beforeAfterLines } from "@/components/landing/beforeAfter";
import { promises } from "@/components/landing/promises";
import { employerLogos } from "@/components/landing/logos";
import { HeroPreview } from "@/components/landing/HeroPreview";
import { LiveDemo } from "@/components/landing/LiveDemo";
import { demoTemplates } from "@/components/landing/demo";
import { getTemplate } from "@/components/templates/registry";
import { sampleCV } from "@/lib/cv/sample";
import { TEMPLATE_COUNT } from "@/lib/templates/catalog";

const EASE = [0.22, 1, 0.36, 1] as const;

interface Feature {
  icon: string;
  title: string;
  body: string;
}

/** Product differentiators — the real capabilities, not filler. Simulate leads:
 *  it's what nothing else does. */
const FEATURES: Feature[] = [
  {
    icon: "◎",
    title: "Simulate the ideal candidate",
    body: "Explore a simulated role-match profile, compare it with your CV, and identify experience and wording you may want to highlight. The simulation is guidance, not an employer decision.",
  },
  {
    icon: "⟳",
    title: "Re-brand any CV",
    body: "Upload a PDF or DOCX and Orire restructures it into a clean, out-of-this-world template — your facts, elegantly re-laid.",
  },
  {
    icon: "✦",
    title: "Tailor to the job",
    body: "Paste a job description and refine your CV to match it — sharpened wording and ordering, never invented experience.",
  },
  {
    icon: "⟂",
    title: "Compare, then pick the best",
    body: "Run two assistants in parallel, see them side by side, and let Orire pick the stronger draft — with the reasoning shown.",
  },
  {
    icon: "⚖",
    title: "A clear CV score",
    body: "Every draft gets a clear score from a fixed rubric, so the same CV always scores the same — watch it climb as you tighten each line.",
  },
  {
    icon: "❖",
    title: `${TEMPLATE_COUNT} standout templates`,
    body: "Explore distinct CV layouts, then see your changes in a live preview as you edit.",
  },
];

/**
 * Public, pre-auth landing page. Advertises the product and routes visitors
 * into the sign-in / sign-up modal (AuthOverlay). Reuses the signature drifting
 * CV showcase and the framer-motion aesthetic used throughout the app.
 */
export function Landing() {
  const openAuth = useUIStore((s) => s.openAuth);

  return (
    <div className="landing">
      {/* Signature living backdrop + legibility scrim (shared with the gate). */}
      <CvShowcase />
      <div className="auth-scrim landing-scrim" aria-hidden />

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
          <ThemeToggle />
          <button className="landing-ghost" onClick={() => openAuth("signin")}>
            Sign in
          </button>
          <button className="landing-cta" onClick={() => openAuth("signup")}>
            Get started
          </button>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-hero-grid landing-hero-centered">
            <motion.div
              className="landing-hero-inner"
              initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, ease: EASE }}
            >
              <span className="landing-eyebrow">Your experience, clearly presented</span>
              <h1 className="landing-title">
                Build a CV that makes your experience stand out.
              </h1>
              <p className="landing-sub">
                Create, refine and download a professional CV with AI-powered
                assistance and carefully designed templates. Keep your experience
                accurate and choose the final wording yourself.
              </p>
              <div className="landing-hero-cta">
                <button className="landing-cta lg" onClick={() => openAuth("signup")}>
                  Create your CV →
                </button>
                <a className="landing-ghost lg" href="#templates">
                  Explore templates
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="how" className="landing-section landing-how landing-how-compact" aria-label="How it works">
          <motion.div
            className="landing-about-head"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <span className="landing-eyebrow">How it works</span>
            <h2 className="landing-h2">Three simple steps to a stronger CV</h2>
          </motion.div>
          <ol className="landing-steps">
            {howItWorksSteps().map((step, i) => (
              <motion.li
                key={step.n}
                className="landing-step"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: EASE }}
              >
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
              <Link key={template.id} className="landing-gallery-card" href={`/templates/${template.id}`}>
                <div className="landing-gallery-art" style={{ background: template.swatch }} aria-hidden="true">
                  <div className="landing-gallery-real-paper">
                    <span className="paper landing-gallery-template">
                      {(() => {
                        const Preview = getTemplate(template.id).Component;
                        return <Preview cv={sampleCV} />;
                      })()}
                    </span>
                  </div>
                </div>
                <span className="landing-gallery-name">{template.name}</span>
                <span className="landing-gallery-description">{template.blurb}</span>
                <span className="landing-gallery-action">Preview template →</span>
              </Link>
            ))}
          </div>
          <p className="landing-gallery-more"><Link href="/templates">View all {TEMPLATE_COUNT} templates →</Link></p>
        </section>

        <section className="landing-section landing-compare" aria-labelledby="landing-compare-heading">
          <div className="landing-about-head">
            <span className="landing-eyebrow">See the transformation</span>
            <h2 id="landing-compare-heading" className="landing-h2">Your experience, with better presentation.</h2>
            <p className="landing-about-lead">Move the divider to compare a fictional example CV before and after formatting.</p>
          </div>
          <HeroPreview />
        </section>

        <section className="landing-logos" aria-label="Target employers">
          <motion.p
            className="landing-logos-cap"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            Explore roles at organizations like these — no affiliation or endorsement implied
          </motion.p>
          <motion.ul
            className="landing-logos-row"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            {employerLogos().map((name) => (
              <li key={name} className="landing-logo-mark">{name}</li>
            ))}
          </motion.ul>
        </section>

        <section className="landing-section landing-ba" aria-label="Before and after">
          <motion.div
            className="landing-about-head"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <span className="landing-eyebrow">Same facts, sharper story</span>
            <h2 className="landing-h2">Watch a flat duty become a hireable win.</h2>
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
                className="landing-ba-row"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.08, duration: 0.5, ease: EASE }}
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

        <section className="landing-trust" aria-label="Why Orire">
          <motion.ul
            className="landing-trust-row"
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            {trustStats().map((stat, i) => (
              <motion.li
                key={stat.label}
                className="landing-trust-item"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ delay: i * 0.08, duration: 0.45, ease: EASE }}
              >
                <span className="landing-trust-value">{stat.value}</span>
                <span className="landing-trust-label">{stat.label}</span>
              </motion.li>
            ))}
          </motion.ul>
        </section>

        <section className="landing-section landing-features" aria-label="Features">
          <motion.h2
            className="landing-h2"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            Everything you need to ship a standout CV
          </motion.h2>
          <div className="landing-grid">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                className="landing-card"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: (i % 3) * 0.08, duration: 0.5, ease: EASE }}
              >
                <span className="landing-card-icon" aria-hidden>{f.icon}</span>
                <h3 className="landing-card-title">{f.title}</h3>
                <p className="landing-card-body">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <LiveDemo />

        <section className="landing-section landing-quotes" aria-label="What to expect">
          <motion.div
            className="landing-about-head"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <span className="landing-eyebrow">What to expect</span>
            <h2 className="landing-h2">Built to move your real experience forward.</h2>
          </motion.div>
          <div className="landing-quote-grid">
            {promises().map((p, i) => (
              <motion.div
                key={p.title}
                className="landing-quote-card"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: (i % 2) * 0.08, duration: 0.5, ease: EASE }}
              >
                <span className="landing-promise-title">{p.title}</span>
                <p className="landing-quote-text">{p.body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="pricing" className="landing-section landing-pricing" aria-label="Pricing">
          <motion.div
            className="landing-about-head"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <span className="landing-eyebrow">Simple, honest pricing</span>
            <h2 className="landing-h2">Start free. Choose a plan when you need more.</h2>
            <p className="landing-about-lead">
              Every plan runs on Orire’s managed AI — no API keys to wrangle, no
              surprise bills. Upgrade, downgrade or cancel anytime.
            </p>
          </motion.div>
          <div className="landing-price-grid">
            {landingPlans().map((p, i) => (
              <motion.div
                key={p.id}
                className={`landing-price-card${p.highlighted ? " is-featured" : ""}`}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.08, duration: 0.5, ease: EASE }}
              >
                {p.highlighted && <span className="landing-price-badge">Recommended</span>}
                <h3 className="landing-price-name">{p.label}</h3>
                <div className="landing-price-amt">
                  <span className="landing-price-num">{p.priceLabel}</span>
                  <span className="landing-price-cad">{p.cadence}</span>
                </div>
                <p className="landing-price-blurb">{p.blurb}</p>
                <ul className="landing-price-perks">
                  {p.perks.map((perk) => (
                    <li key={perk}><span aria-hidden>✓</span> {perk}</li>
                  ))}
                </ul>
                <button
                  className={p.highlighted ? "landing-cta" : "landing-ghost"}
                  onClick={() => openAuth("signup", p.id)}
                >
                  {p.cta}
                </button>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="landing-section landing-final">
          <motion.div
            className="landing-final-card"
            initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <h2 className="landing-h2">Ready to re-brand your CV?</h2>
            <p className="landing-final-sub">
              Create a free account and have a tailored, beautifully designed CV
              in minutes.
            </p>
            <button className="landing-cta lg" onClick={() => openAuth("signup")}>
              Get started free
            </button>
          </motion.div>
        </section>

        <section className="landing-section landing-about" aria-label="About Orire">
          <motion.div
            className="landing-about-head"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <span className="landing-eyebrow">Good fortune, shared</span>
            <h2 className="landing-h2">Be the next to share the good news</h2>
            <p className="landing-about-lead">
              Orire means good fortune — and the good news travels fast. People
              arrive with the CV they already have and leave with one that’s
              structured, elegant and tailored to the role they want. Your story
              stays honest and yours: Orire works from your facts, shows its
              reasoning, and keeps a consistent CV score so you can see exactly
              how far a draft has moved. Land the role, then pass the luck on.
            </p>
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
