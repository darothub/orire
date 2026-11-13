"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

const SCALE = 0.74;

/** Renders a CV page at a reduced scale and sizes its box to the scaled content,
 *  so a scrolling parent ends exactly at the last line instead of the unscaled height. */
const PAGE_WIDTH = 794;

/** Renders a CV at true page width and scales it to fit its container, so narrow
 *  columns show the whole layout (skills column included) instead of a squeezed one. */
export function FitPaper({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ scale: number; height?: number }>({ scale: 0.5 });

  useLayoutEffect(() => {
    const b = box.current;
    const el = inner.current;
    if (!b || !el) return;
    const measure = () => {
      const scale = Math.min(1, b.clientWidth / PAGE_WIDTH);
      setFit({ scale, height: Math.ceil(el.offsetHeight * scale) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(b);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} className="tgt-paper-box" style={fit.height ? { height: fit.height } : undefined}>
      <div
        ref={inner}
        className="tgt-paper-fit"
        style={{ width: PAGE_WIDTH, transform: `scale(${fit.scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

export function ScaledPaper({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setHeight(Math.ceil(el.offsetHeight * SCALE));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="tgt-paper-box" style={height ? { height } : undefined}>
      <div ref={inner} className="tgt-paper">{children}</div>
    </div>
  );
}
