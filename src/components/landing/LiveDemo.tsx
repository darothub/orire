"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "framer-motion";
import { getTemplate } from "@/components/templates/registry";
import { demoTemplates } from "@/components/landing/demo";
import { landingCV as sampleCV } from "@/components/landing/landingCv";
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
    <section id="demo" className="lp-section" aria-label="Try Orire">
     <div className="lp-wrap">
      <div className="lp-head">
        <span className="lp-eyebrow">See it live</span>
        <h2 className="lp-h2">Preview a fictional example CV, choose a template and watch its layout change.</h2>
      </div>

      <div className="lp-demo-stage">
        <div className="lp-demo-rail" role="group" aria-label="Demo templates">
          {options.map((t) => {
            const selected = t.id === activeId;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={selected}
                className={`lp-swatch${selected ? " is-active" : ""}`}
                onClick={() => setActiveId(t.id)}
              >
                <span className="lp-swatch-chip" style={{ background: t.swatch }} aria-hidden />
                <span className="lp-swatch-meta">
                  <span className="lp-swatch-name">{t.name}</span>
                  <span className="lp-swatch-blurb">{t.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="lp-demo-preview">
          <div className="lp-demo-frame" role="group" aria-label="Fictional example CV preview">
            <button
              type="button"
              className="lp-demo-expand"
              ref={expandRef}
              onClick={() => { setFullPreviewOpen(true); dialogRef.current?.showModal(); }}
              aria-label={`Enlarge ${active.name} CV preview`}
            >
              <span aria-hidden="true">⤢</span>
              View full CV
            </button>
            <MotionConfig reducedMotion="user">
              <AnimatePresence mode={reducedMotion ? "sync" : "wait"}>
                <motion.div
                  key={activeId}
                  className="lp-demo-scale"
                  initial={reducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.3, ease: EASE }}
                >
                  {/* The document scales separately from the motion wrapper,
                      so Framer Motion cannot override its responsive scale. */}
                  <div className="paper lp-demo-paper" aria-hidden="true" inert>
                    <Component cv={sampleCV} />
                  </div>
                </motion.div>
              </AnimatePresence>
            </MotionConfig>
          </div>
          <dialog
            ref={dialogRef}
            className="lp-dialog"
            onClose={() => { setFullPreviewOpen(false); expandRef.current?.focus({ preventScroll: true }); }}
            onCancel={() => { setFullPreviewOpen(false); }}
            aria-labelledby="lp-dialog-heading"
            aria-describedby="lp-dialog-description"
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
            <div className="lp-dialog-head">
              <div>
                <h3 id="lp-dialog-heading">{active.name}, full-size CV preview</h3>
                <p id="lp-dialog-description">
                  Fictional details. Scroll vertically and sideways to inspect the full-size document.
                </p>
              </div>
              <button
                type="button"
                className="lp-dialog-close"
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
              <h4>{sampleCV.basics.fullName}, {sampleCV.basics.title}</h4>
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
              className="lp-dialog-scroll"
              role="region"
              aria-label={`Full-size ${active.name} fictional CV`}
              tabIndex={0}
            >
              <div className="paper lp-full-paper" aria-hidden="true" inert>
                {fullPreviewOpen && <Component cv={sampleCV} />}
              </div>
            </div>
          </dialog>
          <div className="lp-demo-foot">
            <span className="lp-demo-foot-label" role="status" aria-live="polite" aria-atomic="true">
              Previewing <strong>{active.name}</strong> with fictional example details. Your own CV stays yours.
            </span>
            <button type="button" className="lp-btn lp-btn--primary" onClick={() => openAuth("signup")}>
              Start free with your own CV
            </button>
          </div>
        </div>
      </div>
     </div>
    </section>
  );
}
