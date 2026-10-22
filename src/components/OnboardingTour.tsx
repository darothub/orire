"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
    body: "A 30-second tour of your AI CV studio. Each tool is a building block you arrange into your own flow. You can replay this any time from ⌘K → “Take the tour”.",
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
    body: "Tailor your CV to a job description. Compare two assistants side by side and let Orire pick the best of the two.",
    place: "right",
  },
  {
    sel: '[data-tour="rail-target"]',
    title: "Simulate a role",
    body: "Simulate what a 100%-match CV for a job would look like, then edit yours toward it.",
    place: "right",
  },
  {
    sel: '[data-tour="rail-home"]',
    title: "Arrange your flow",
    body: "This left panel is yours. Drag blocks to reorder them, and tap Home (or ＋) to add or remove blocks from your flow. Open any block to see your live CV beside it.",
    place: "right",
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
  const tourRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const reducedMotion = useReducedMotion();
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

  // A modal must make its background inaccessible and return keyboard focus
  // after closing. The tour renders via a portal into document.body, so marking
  // the app shell inert does not hide the tour itself from assistive technology.
  useEffect(() => {
    if (!active) return;

    const opener = document.activeElement;
    openerRef.current =
      opener instanceof HTMLElement && opener !== document.body ? opener : null;
    const workspace = document.querySelector<HTMLElement>(".app.has-rail");
    const previouslyInert = workspace?.hasAttribute("inert") ?? false;
    if (workspace && !previouslyInert) workspace.setAttribute("inert", "");

    return () => {
      if (workspace && !previouslyInert) workspace.removeAttribute("inert");
      const target = openerRef.current;
      openerRef.current = null;
      if (target?.isConnected) {
        target.focus({ preventScroll: true });
      } else {
        // Replaying from the command palette can unmount its original button.
        document.querySelector<HTMLElement>(".cmdk-hint-btn, .rail button")
          ?.focus({ preventScroll: true });
      }
    };
  }, [active]);

  // Each step changes the dialog's accessible description. Move focus to its
  // heading so a screen reader announces the current step and instructions.
  useEffect(() => {
    if (!active) return;
    const raf = window.requestAnimationFrame(() => {
      tourRef.current?.querySelector<HTMLElement>(".tour-title")
        ?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [active, step]);

  // Escape closes the tour. Tab stays inside the modal. Deliberately do not
  // hijack Enter or arrow keys globally: Enter on "Back" or "Skip" must invoke
  // that button's own native behavior, never unexpectedly advance a step.
  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        stop();
        return;
      }
      if (event.key !== "Tab") return;

      const card = tourRef.current?.querySelector<HTMLElement>(".tour-card");
      if (!card) return;
      const buttons = Array.from(
        card.querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
      );
      if (!buttons.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      const focused = document.activeElement;

      if (event.shiftKey && focused === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && focused === last) {
        event.preventDefault();
        first.focus();
      } else if (!(focused instanceof HTMLElement) || !card.contains(focused)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }

    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [active, stop]);

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
          ref={tourRef}
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label="Getting started tour"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
        >
          {/* Click-catcher: tapping the dimmed area advances the tour. */}
          <button
            className={`tour-catch${spot ? "" : " is-dim"}`}
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => (isLast ? stop() : next())}
          />

          {spot && (
            <div className="tour-spot" style={spot} aria-hidden />
          )}

          <motion.div
            key={step}
            className="tour-card"
            style={{ width: CARD_W, ...cardPosition(rect, current.place) }}
            initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
          >
            <div className="tour-step">Step {step + 1} of {STEPS.length}</div>
            <h3 id={titleId} className="tour-title" tabIndex={-1}>{current.title}</h3>
            <p id={descriptionId} className="tour-body">{current.body}</p>

            <div className="tour-dots" aria-hidden>
              {STEPS.map((_, i) => (
                <span key={i} className={`tour-dot${i === step ? " is-on" : ""}`} />
              ))}
            </div>

            <div className="tour-actions">
              {!isLast && (
                <button className="tour-skip" onClick={() => stop()}>Skip</button>
              )}
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
