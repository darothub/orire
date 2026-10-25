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
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);
  const expandRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const openAuth = useUIStore((s) => s.openAuth);
  const Component = getTemplate(activeId).Component;
  const active = options.find((o) => o.id === activeId) ?? options[0];

  return (
    <section id="demo" className="landing-section landing-demo" aria-label="Try Orire">
      <motion.div
        className="landing-about-head"
        initial={reducedMotion ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.5, ease: EASE }}
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
              ref={expandRef}
              onClick={() => { setFullPreviewOpen(true); dialogRef.current?.showModal(); }}
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
                  exit={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
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
            onClose={() => { setFullPreviewOpen(false); expandRef.current?.focus({ preventScroll: true }); }}\n            onCancel={() => { setFullPreviewOpen(false); }}
            aria-labelledby="landing-demo-dialog-heading"
            aria-describedby="landing-demo-dialog-description"
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const dialog = dialogRef.current;
              if (!dialog) return;
              const controls = Array.from(
                dialog.querySelectorAll<HTMLElement>(
                  'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
                ),
              ).filter((element) => !element.hasAttribute("inert") && element.getClientRects().length > 0);
              if (controls.length === 0) {
                event.preventDefault();
                dialog.focus();
                return;
              }
              const current = document.activeElement;
              const index = controls.findIndex((element) => element === current);
              if (event.shiftKey && index <= 0) {
                event.preventDefault();
                controls[controls.length - 1].focus();
              } else if (!event.shiftKey && (index === -1 || index === controls.length - 1)) {
                event.preventDefault();
                controls[0].focus();
              }
            }}
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
            {/* The rendered CV is intentionally inert, so its embedded contact
                links cannot steal focus. Expose the actual fictional data as
                semantic text for screen-reader visitors instead. */}
            <section className="sr-only" aria-label="Fictional CV text alternative">
              <h4>{sampleCV.basics.fullName} — {sampleCV.basics.title}</h4>
              <p>{sampleCV.basics.location}. {sampleCV.basics.summary}</p>
              <h5>Experience</h5>
              <ul>
                {sampleCV.experience.map((entry) => (
                  <li key={entry.id}>
                    {entry.role} at {entry.company}, {entry.startDate} to {entry.current ? "present" : entry.endDate}.
                    <ul>
                      {entry.highlights.map((line) => <li key={line}>{line}</li>)}
                    </ul>
                  </li>
                ))}
              </ul>
              <h5>Education</h5>
              <ul>
                {sampleCV.education.map((entry) => (
                  <li key={entry.id}>{entry.degree} {entry.field}, {entry.institution}</li>
                ))}
              </ul>
              <h5>Skills</h5>
              <ul>
                {sampleCV.skills.map((group) => (
                  <li key={group.id}>{group.category}: {group.items.join(", ")}</li>
                ))}
              </ul>
            </section>
            <div
              className="landing-demo-dialog-scroll"
              role="region"
              aria-label={`Full-size ${active.name} fictional CV`}
              tabIndex={0}
            >
              <div className="paper landing-demo-full-paper" aria-hidden="true" inert>
                {fullPreviewOpen && <Component cv={sampleCV} />}
              </div>
            </div>
          </dialog>
          <div className="landing-demo-foot">
            <span className="landing-demo-foot-label" role="status" aria-live="polite" aria-atomic="true">
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
