"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Fade-and-rise on first scroll into view. The hidden state is armed from the
 * client only, so server-rendered content is always visible, and reduced-motion
 * users never get it (the stylesheet also forces the final state).
 */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.classList.add("lp-rv");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.classList.add("is-shown");
        io.disconnect();
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}
