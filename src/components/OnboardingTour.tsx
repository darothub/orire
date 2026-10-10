"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useOnboardingStore } from "@/lib/store/onboardingStore";

type Place = "right" | "left" | "bottom" | "center";

interface Step {
  /** CSS selector for the element to spotlight, or null for a centered card. */
  sel: string | null;
  title: string;
  body: string;
  place: Place;
}

/** Guided first-run tour. Each step spotlights a real part of the UI (rail
 *  items + the live preview) and floats an explainer card beside it. Auto-opens
 *  once for new users (localStorage-gated in the store) and can be replayed from
 *  the command palette. Keyboard- and click-driven; honours reduced motion. */
const STEPS: Step[] = [
  {
    sel: null,
    title: "Welcome to orire",
    body: "A 30-second tour of your AI CV builder. You can replay it any time from ⌘K → “Take the tour”.",
    place: "center",
  },
  {
    sel: '[data-tour="rail-edit"]',
    title: "Edit, live",
    body: "The two-pane editor: type on the left and your CV updates instantly on the right. Drag sections, cards and bullets to reorder.",
    place: "right",
  },
  {
    sel: '[data-tour="rail-rebrand"]',
    title: "Re-brand an old CV",
    body: "Drop in an existing CV (PDF or DOCX) and restructure it into any template — preview the result before you apply it.",
    place: "right",
  },
  {
    sel: '[data-tour="rail-refine"]',
    title: "Refine with AI",
    body: "Tailor your CV to a job description. Compare two assistants side by side and let the judge merge the best of both.",
    place: "right",
  },
  {
    sel: '[data-tour="rail-target"]',
    title: "Target a role",
    body: "Simulate what a 100%-match CV for a job would look like, then edit yours toward it.",
    place: "right",
  },
  {
    sel: ".pane-preview",
    title: "Your live CV",
    body: "The real document — exactly what exports to PDF. Hit “Edit on preview” to type directly on the page.",
    place: "left",
  },
  {
    sel: ".theme-toggle",
    title: "Make it yours",
    body: "Switch between light and dark whenever you like. That’s the tour — enjoy orire!",
    place: "bottom",
  },
];

const PAD = 8; // breathing room around the spotlighted element
const CARD_W = 320;
const GAP = 16; // gap between target and card

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function cardPosition(rect: Rect | null, place: Place): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!rect || place === "center") {
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }
  let top: number;
  let left: number;
  if (place === "right") {
    left = rect.left + rect.width + GAP;
    top = rect.top + rect.height / 2;
  } else if (place === "left") {
    left = rect.left - CARD_W - GAP;
    top = rect.top + rect.height / 2;
  } else {
    // bottom
    left = rect.left + rect.width / 2 - CARD_W / 2;
    top = rect.top + rect.height + GAP;
  }
  // Clamp horizontally so the card never leaves the viewport.
  left = Math.max(GAP, Math.min(left, vw - CARD_W - GAP));
  // For side placements the card is vertically centred on the target; clamp it.
  if (place === "right" || place === "left") {
    top = Math.max(GAP + 80, Math.min(top, vh - GAP - 80));
    return { top, left, transform: "translateY(-50%)" };
  }
  top = Math.max(GAP, Math.min(top, vh - GAP - 180));
  return { top, left };
}

export function OnboardingTour() {
  const active = useOnboardingStore((s) => s.active);
  const step = useOnboardingStore((s) => s.step);
  const next = useOnboardingStore((s) => s.next);
  const back = useOnboardingStore((s) => s.back);
  const stop = useOnboardingStore((s) => s.stop);

  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const current = STEPS[Math.min(step, STEPS.length - 1)];
  const isLast = step >= STEPS.length - 1;

  // Measure the current target so the spotlight and card track it, and keep it
  // fresh on resize/scroll. Runs synchronously before paint to avoid a flash.
  const measure = useCallback(() => {
    if (!current?.sel) {
      setRect(null);
      return;
    }
    const el = document.querySelector(current.sel);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [current]);

  useLayoutEffect(() => {
    if (!active) return;
    // Sanctioned setState-in-effect: this reads real layout (getBoundingClientRect)
    // from the DOM and mirrors it into state so the spotlight tracks the target —
    // syncing to an external system, not deriving data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, measure]);

  // Keyboard driving: →/Enter next, ← back, Esc skip.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        stop();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        if (isLast) stop();
        else next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, isLast, next, back, stop]);

  if (!mounted) return null;

  const spot: React.CSSProperties | null = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  return createPortal(
    <AnimatePresence>
      {active && (
        <motion.div
          className="tour-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label="Getting started tour"
        >
          {/* Click-catcher: tapping the dimmed area advances the tour. */}
          <button
            className={`tour-catch${spot ? "" : " is-dim"}`}
            aria-label="Advance to next step"
            onClick={() => (isLast ? stop() : next())}
          />

          {spot && (
            <div className="tour-spot" style={spot} aria-hidden />
          )}

          <motion.div
            key={step}
            className="tour-card"
            style={{ width: CARD_W, ...cardPosition(rect, current.place) }}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            <div className="tour-step">Step {step + 1} of {STEPS.length}</div>
            <h3 className="tour-title">{current.title}</h3>
            <p className="tour-body">{current.body}</p>

            <div className="tour-dots" aria-hidden>
              {STEPS.map((_, i) => (
                <span key={i} className={`tour-dot${i === step ? " is-on" : ""}`} />
              ))}
            </div>

            <div className="tour-actions">
              <button className="tour-skip" onClick={() => stop()}>
                {isLast ? "" : "Skip"}
              </button>
              <div className="tour-nav">
                {step > 0 && (
                  <button className="btn-ghost" onClick={() => back()}>Back</button>
                )}
                <button className="btn-primary" onClick={() => (isLast ? stop() : next())}>
                  {isLast ? "Done" : "Next"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
