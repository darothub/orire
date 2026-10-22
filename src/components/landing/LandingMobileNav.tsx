"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useUIStore } from "@/lib/store/uiStore";

const SECTIONS = [
  { href: "#how", label: "How it works" },
  { href: "#templates", label: "Templates" },
  { href: "#demo", label: "Live demo" },
  { href: "#pricing", label: "Pricing" },
] as const;

/**
 * Public landing navigation, visible when the desktop section links collapse.
 * Disclosure menu: Escape and outside press dismiss it, links dismiss on
 * navigation, and reduced-motion users do not receive transform animations.
 */
export function LandingMobileNav() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const openAuth = useUIStore((s) => s.openAuth);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    function onResize() {
      if (window.innerWidth > 860) setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <div className="landing-mobile-menu" ref={rootRef}>
      <button
        ref={toggleRef}
        type="button"
        className={`landing-mobile-menu-toggle${open ? " is-open" : ""}`}
        aria-label={open ? "Close section menu" : "Open section menu"}
        aria-expanded={open}
        aria-controls="landing-mobile-section-links"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="landing-mobile-menu-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.nav
            id="landing-mobile-section-links"
            className="landing-mobile-menu-panel"
            aria-label="Mobile page sections"
            initial={reducedMotion ? false : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
          >
            {SECTIONS.map(({ href, label }) => (
              <a key={href} href={href} onClick={() => setOpen(false)}>
                {label}
              </a>
            ))}
            <button
              type="button"
              className="landing-mobile-menu-signin"
              onClick={() => {
                setOpen(false);
                openAuth("signin");
              }}
            >
              Sign in
            </button>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}
