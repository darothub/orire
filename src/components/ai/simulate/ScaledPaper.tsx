"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

const SCALE = 0.74;

/** Renders a CV page at a reduced scale and sizes its box to the scaled content,
 *  so a scrolling parent ends exactly at the last line instead of the unscaled height. */
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
