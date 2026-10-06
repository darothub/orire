"use client";

import { useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { getTemplate } from "@/components/templates/registry";
import { demoTemplates } from "@/components/landing/demo";
import { plainCvLines } from "@/components/landing/plainCv";
import { sampleCV } from "@/lib/cv/sample";
import { useUIStore } from "@/lib/store/uiStore";

const EASE = [0.22, 1, 0.36, 1] as const;

type DemoView = "before" | "after";

/**
 * Pre-signup interactive demo: visitors re-brand a real sample CV across the
 * product's actual templates, live, with no account or AI key required.
 */
export function LiveDemo() {
  const options = demoTemplates();
  const [activeId, setActiveId] = useState(options[0].id);
  const [view, setView] = useState<DemoView>("after");
  const openAuth = useUIStore((s) => s.openAuth);
  const Component = getTemplate(activeId).Component;
  const active = options.find((o) => o.id === activeId) ?? options[0];
  const plain = plainCvLines(sampleCV);

  return (
    <section id="demo" className="landing-section landing-demo" aria-label="Try Orire">
      <motion.div
        className="landing-about-head"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <span className="landing-eyebrow">See it live</span>
        <h2 className="landing-h2">Re-brand a real CV right now — pick a template and watch it transform.</h2>
      </motion.div>

      <div className="landing-demo-stage">
        <div className="landing-demo-rail" role="tablist" aria-label="Demo templates">
          {options.map((t) => {
            const selected = t.id === activeId;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`landing-demo-swatch${selected ? " is-active" : ""}`}
                onClick={() => {
                  setActiveId(t.id);
                  setView("after");
                }}
              >
                <span className="landing-demo-chip" style={{ background: t.swatch }} aria-hidden />
                <span className="landing-demo-meta">
                  <span className="landing-demo-name">{t.name}</span>
                  <span className="landing-demo-blurb">{t.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="landing-demo-preview">
          <div className="landing-demo-toggle" role="tablist" aria-label="Before and after">
            <button
              type="button"
              role="tab"
              aria-selected={view === "before"}
              className={`landing-demo-toggle-btn${view === "before" ? " is-active" : ""}`}
              onClick={() => setView("before")}
            >
              Before · plain text
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "after"}
              className={`landing-demo-toggle-btn${view === "after" ? " is-active" : ""}`}
              onClick={() => setView("after")}
            >
              After · re-branded
            </button>
          </div>

          <div className="landing-demo-frame" aria-live="polite">
            <MotionConfig reducedMotion="user">
              <AnimatePresence mode="wait">
                {view === "before" ? (
                  <motion.pre
                    key="before"
                    className="landing-demo-plain"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4, ease: EASE }}
                  >
                    {plain.join("\n")}
                  </motion.pre>
                ) : (
                  <motion.div
                    key={activeId}
                    className="landing-demo-paper-scale"
                    initial={{ opacity: 0, y: 14, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.985 }}
                    transition={{ duration: 0.45, ease: EASE }}
                  >
                    <div className="paper landing-demo-paper">
                      <Component cv={sampleCV} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </MotionConfig>
          </div>
          <div className="landing-demo-foot">
            <span className="landing-demo-foot-label">
              {view === "before" ? (
                <>The raw CV you&apos;d paste in — flat, unstyled text.</>
              ) : (
                <>Previewing <strong>{active.name}</strong> — your real CV, instantly re-branded.</>
              )}
            </span>
            <button type="button" className="landing-cta" onClick={() => openAuth("signup")}>
              Start free with your own CV
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
