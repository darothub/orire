"use client";

import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  /** Short name of the thing, used for the touch ⓘ button's accessible label. */
  title: string;
  /** The explanatory line shown in the bubble ("what it's good at"). */
  hint: string;
  /** Preferred side of the trigger for the bubble. Default "right". */
  placement?: "right" | "bottom";
  /** The trigger element (e.g. a button). Receives hover/focus + aria wiring. */
  children: ReactElement<HTMLAttributes<HTMLElement>>;
}

const MAX_W = 220; // keep in sync with .tt-bubble max-width
const GAP = 10; // space between trigger and bubble
const MARGIN = 8; // min distance from the viewport edge

/**
 * Accessible, reusable tooltip.
 *
 * - Desktop (hover-capable pointers): shows on hover and on keyboard focus.
 * - Touch (no hover): a small ⓘ button toggles the bubble, so the trigger's
 *   own tap still performs its primary action. The ⓘ is hidden on desktop.
 *
 * The bubble is portaled to <body> with fixed positioning, so it is never
 * clipped by an ancestor's overflow (e.g. the rail's scrolling strip on
 * narrow viewports). It is wired to the trigger via `aria-describedby` and
 * closes on Escape, scroll, or an outside tap.
 */
export function Tooltip({ title, hint, placement = "right", children }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hoverCapable, setHoverCapable] = useState(false);
  const [pos, setPos] = useState<CSSProperties | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  // Client-only: portal target exists, and decide whether this device hovers.
  // Gating the hover/focus openers behind this keeps a tap on the trigger from
  // flashing the tooltip on touch — there, the ⓘ is the way in.
  useEffect(() => {
    // Sanctioned setState-in-effect: these sync to client-only signals
    // (portal target existence + pointer capability), not to derived data —
    // neither is knowable during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setHoverCapable(window.matchMedia("(hover: hover)").matches);
  }, []);

  const place = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left: number;
    let top: number;
    if (placement === "bottom") {
      left = r.left + r.width / 2 - MAX_W / 2;
      top = r.bottom + GAP;
    } else {
      left = r.right + GAP;
      top = r.top + r.height / 2;
    }
    // Keep the bubble inside the viewport horizontally.
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - MAX_W - MARGIN));
    setPos({
      position: "fixed",
      left: Math.round(left),
      top: Math.round(top),
      transform: placement === "bottom" ? undefined : "translateY(-50%)",
    });
  }, [placement]);

  // Measure when opening; dismiss on Escape / scroll / outside pointer.
  useEffect(() => {
    if (!open) return;
    place();
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, place]);

  const hoverProps = hoverCapable
    ? {
        onMouseEnter: () => setOpen(true),
        onMouseLeave: () => setOpen(false),
        onFocus: () => setOpen(true),
        onBlur: () => setOpen(false),
      }
    : {};

  const trigger = cloneElement(children, {
    "aria-describedby": open ? id : undefined,
    ...hoverProps,
  });

  return (
    <span className="tt-wrap" ref={wrapRef}>
      {trigger}
      <button
        type="button"
        className="tt-info"
        aria-label={`What is ${title} for?`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        i
      </button>
      {mounted &&
        createPortal(
          <span role="tooltip" id={id} className={`tt-bubble${open ? " is-open" : ""}`} style={pos ?? undefined}>
            {hint}
          </span>,
          document.body,
        )}
    </span>
  );
}
