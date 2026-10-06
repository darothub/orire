"use client";

import { useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { getTemplate } from "@/components/templates/registry";
import { demoTemplates } from "@/components/landing/demo";
import { plainCvLines } from "@/components/landing/plainCv";
import { sampleCV } from "@/lib/cv/sample";

const EASE = [0.22, 1, 0.36, 1] as const;

type HeroView = "before" | "after";

/**
 * Compact hero proof: a single real CV shown as the plain text you'd paste in
 * ("Before") versus the re-branded template Orire produces ("After"), toggled
 * in place. No account, AI key or template picking — a one-glance promise of
 * the transformation, with the full interactive demo further down the page.
 */
export function HeroPreview() {
  const [view, setView] = useState<HeroView>("after");
  const featured = demoTemplates()[0];
  const Component = getTemplate(featured.id).Component;
  const plain = plainCvLines(sampleCV);

  return (
    <motion.div
      className="landing-hero-visual"
      initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
      aria-label="Before and after preview"
    >
      <div className="landing-hero-toggle" role="tablist" aria-label="Before and after">
        <button
          type="button"
          role="tab"
          aria-selected={view === "before"}
          className={`landing-hero-toggle-btn${view === "before" ? " is-active" : ""}`}
          onClick={() => setView("before")}
        >
          Before
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "after"}
          className={`landing-hero-toggle-btn${view === "after" ? " is-active" : ""}`}
          onClick={() => setView("after")}
        >
          After
        </button>
      </div>

      <div className="landing-hero-frame" aria-live="polite">
        <MotionConfig reducedMotion="user">
          <AnimatePresence mode="wait">
            {view === "before" ? (
              <motion.pre
                key="before"
                className="landing-hero-plain"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                {plain.join("\n")}
              </motion.pre>
            ) : (
              <motion.div
                key="after"
                className="landing-hero-paper-scale"
                initial={{ opacity: 0, y: 14, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.985 }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                <div className="paper landing-hero-paper">
                  <Component cv={sampleCV} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </MotionConfig>
      </div>

      <span className="landing-hero-frame-label">
        {view === "before" ? (
          <>Your CV as plain, unstyled text.</>
        ) : (
          <>Re-branded with <strong>{featured.name}</strong> — same facts, elevated.</>
        )}
      </span>
    </motion.div>
  );
}
