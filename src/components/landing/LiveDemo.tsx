"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "framer-motion";
import { getTemplate } from "@/components/templates/registry";
import { demoTemplates } from "@/components/landing/demo";
import { sampleCV } from "@/lib/cv/sample";
import { useUIStore } from "@/lib/store/uiStore";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Pre-signup interactive demo: visitors re-brand a real sample CV across the
 * product's actual templates, live, with no account or AI key required.
 */
export function LiveDemo() {
  const options = demoTemplates();
  const [activeId, setActiveId] = useState(options[0].id);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reducedMotion = useReducedMotion();
  const openAuth = useUIStore((s) => s.openAuth);
  const Component = getTemplate(activeId).Component;
  const active = options.find((o) => o.id === activeId) ?? options[0];

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
        <h2 className="landing-h2">Preview a fictional example CV — choose a template and watch its layout change.</h2>
      </motion.div>

      <div className="landing-demo-stage">
        <div className="landing-demo-rail" role="group" aria-label="Demo templates">
          {options.map((t) => {
            const selected = t.id === activeId;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={selected}
                className={`landing-demo-swatch${selected ? " is-active" : ""}`}
                onClick={() => setActiveId(t.id)}
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
          <div className="landing-demo-frame" aria-label="Fictional example CV preview">
            <button
              type="button"
              className="landing-demo-expand"
              onClick={() => dialogRef.current?.showModal()}
              aria-label={`Enlarge ${active.name} CV preview`}
            >
              <span aria-hidden="true">⤢</span>
              View full CV
            </button>
            <MotionConfig reducedMotion="user">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeId}
                  className="landing-demo-paper-scale"
                  initial={reducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.3, ease: EASE }}
                >
                  {/* The document scales separately from the motion wrapper,
                      so Framer Motion cannot override its responsive scale. */}
                  <div className="paper landing-demo-paper" aria-hidden="true" inert>
                    <Component cv={sampleCV} />
                  </div>
                </motion.div>
              </AnimatePresence>
            </MotionConfig>
          </div>
          <dialog
            ref={dialogRef}
            className="landing-demo-dialog"
            aria-labelledby="landing-demo-dialog-heading"
            aria-describedby="landing-demo-dialog-description"
            onClick={(event) => {
              if (event.target === dialogRef.current) dialogRef.current?.close();
            }}
          >
            <div className="landing-demo-dialog-header">
              <div>
                <h3 id="landing-demo-dialog-heading">{active.name} — full-size CV preview</h3>
                <p id="landing-demo-dialog-description">
                  Fictional details. Scroll vertically and sideways to inspect the full-size document.
                </p>
              </div>
              <button
                type="button"
                className="landing-demo-dialog-close"
                onClick={() => dialogRef.current?.close()}
                aria-label="Close full-size preview"
              >
                Close <span aria-hidden="true">×</span>
              </button>
            </div>
            <div
              className="landing-demo-dialog-scroll"
              role="region"
              aria-label={`Full-size ${active.name} fictional CV`}
              tabIndex={0}
            >
              <div className="paper landing-demo-full-paper" aria-hidden="true" inert>
                <Component cv={sampleCV} />
              </div>
            </div>
          </dialog>
          <div className="landing-demo-foot">
            <span className="landing-demo-foot-label">
              Previewing <strong>{active.name}</strong> with fictional example details. Your own CV stays yours.
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
