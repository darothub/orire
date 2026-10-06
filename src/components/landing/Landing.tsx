"use client";

import { motion } from "framer-motion";
import { useUIStore } from "@/lib/store/uiStore";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { CvShowcase } from "@/components/landing/CvShowcase";
import { landingPlans } from "@/components/landing/pricing";

const EASE = [0.22, 1, 0.36, 1] as const;

interface Feature {
  icon: string;
  title: string;
  body: string;
}

/** Product differentiators — the real capabilities, not filler. */
const FEATURES: Feature[] = [
  {
    icon: "⟳",
    title: "Re-brand any CV",
    body: "Upload a PDF or DOCX and Orire restructures it into a clean, out-of-the-world template — your facts, elegantly re-laid.",
  },
  {
    icon: "✦",
    title: "Tailor to the job",
    body: "Paste a job description and refine your CV to match it — sharpened wording and ordering, never invented experience.",
  },
  {
    icon: "⟂",
    title: "Compare, then judge",
    body: "Run two assistants in parallel, see them side by side, and let an LLM-as-judge pick the strongest result with its reasoning shown.",
  },
  {
    icon: "⚖",
    title: "Deterministic rating",
    body: "A fixed rubric scores every draft with no model call, so the same CV always earns the same score — measure real progress.",
  },
  {
    icon: "◎",
    title: "Simulate the perfect match",
    body: "See the CV that would match a role 100%, then move your real experience toward that concrete target.",
  },
  {
    icon: "❖",
    title: "20 standout templates",
    body: "Beautifully animated, ATS-ready layouts — live preview on the right while you edit on the left.",
  },
];

interface Principle {
  icon: string;
  title: string;
  body: string;
}

/** Operating principles — lifted from the former in-app About view. */
const PRINCIPLES: Principle[] = [
  {
    icon: "✦",
    title: "Grounded in your facts",
    body: "Every rewrite, refinement and cover letter is built from the facts in your CV. Orire restructures and sharpens — it never invents jobs, dates or numbers you didn't provide.",
  },
  {
    icon: "⚖",
    title: "Deterministic rating",
    body: "Your CV is scored against a fixed rubric with no model call, so the same CV always earns the same score. You can measure a real improvement, not a mood.",
  },
  {
    icon: "⟂",
    title: "Compare, then judge",
    body: "Run two assistants in parallel, see them side by side, and let an LLM-as-judge pick the strongest result — with the reasoning shown, never hidden.",
  },
  {
    icon: "◎",
    title: "Simulate the perfect match",
    body: "Paste a job description and Orire renders the CV that would match it 100% — a concrete target to aim for, then refines your real experience toward it without inventing anything.",
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
          <span className="landing-brand-tag">CV studio</span>
        </div>
        <div className="landing-nav-actions">
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
          <motion.div
            className="landing-hero-inner"
            initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <span className="landing-eyebrow">Your CV, re-branded</span>
            <h1 className="landing-title">
              Turn the CV you have into the one the role wants.
            </h1>
            <p className="landing-sub">
              Upload what you have. Orire re-brands it into an elegant template,
              refines it against any job description, compares two AI assistants
              and scores every draft — so you can see exactly how far it moved.
            </p>
            <div className="landing-hero-cta">
              <button className="landing-cta lg" onClick={() => openAuth("signup")}>
                Get started free
              </button>
              <button className="landing-ghost lg" onClick={() => openAuth("signin")}>
                I already have an account
              </button>
            </div>
            <ul className="landing-usps" aria-label="What Orire does">
              <li><span aria-hidden>✎</span> Upload PDF &amp; DOCX</li>
              <li><span aria-hidden>❖</span> 20 standout templates</li>
              <li><span aria-hidden>⚖</span> Deterministic rating</li>
            </ul>
          </motion.div>
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
              reasoning, and keeps a deterministic score so you can see exactly
              how far a draft has moved. Land the role, then pass the luck on.
            </p>
          </motion.div>
          <div className="landing-grid about">
            {PRINCIPLES.map((p, i) => (
              <motion.div
                key={p.title}
                className="landing-card"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: (i % 2) * 0.08, duration: 0.5, ease: EASE }}
              >
                <span className="landing-card-icon" aria-hidden>{p.icon}</span>
                <h3 className="landing-card-title">{p.title}</h3>
                <p className="landing-card-body">{p.body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="landing-section landing-pricing" aria-label="Pricing">
          <motion.div
            className="landing-about-head"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <span className="landing-eyebrow">Simple, honest pricing</span>
            <h2 className="landing-h2">Start free. Upgrade when it lands you interviews.</h2>
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
                {p.highlighted && <span className="landing-price-badge">Most popular</span>}
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
                  onClick={() => openAuth("signup")}
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
      </main>

      <footer className="landing-foot">
        <span className="landing-foot-mark">Orire</span>
        <span className="landing-foot-copy">
          © {new Date().getFullYear()} Orire · CV studio
        </span>
      </footer>
    </div>
  );
}
