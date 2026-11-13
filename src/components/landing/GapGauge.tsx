"use client";

import { useEffect, useRef, useState } from "react";

function useCountUp(target: number, run: boolean) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) {
      const id = requestAnimationFrame(() => setV(0));
      return () => cancelAnimationFrame(id);
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setV(target));
      return () => cancelAnimationFrame(id);
    }
    const t0 = performance.now();
    const ms = 1600;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return v;
}

const BEFORE = { score: 54, missing: ["Kubernetes", "CI/CD", "TDD"] };
const AFTER = { score: 91 };

/** Illustrative before/after match score — the promise of Simulate → Coach → Rewrite in one glance. */
export function GapGauge() {
  const [on, setOn] = useState(false);
  const ref = useRef<HTMLElement>(null);
  // Replay every time the gauge scrolls into view; reset when it leaves.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setOn(entry.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const before = useCountUp(BEFORE.score, on);
  const after = useCountUp(AFTER.score, on);
  return (
    <figure ref={ref} className="gx-gauge" aria-label="Illustrative match score before and after">
      <div className="gx-gauge-col is-before">
        <span className="gx-gauge-k">Your CV · today</span>
        <p className="gx-gauge-n">{before}<small>% match</small></p>
        <div className="gx-bar"><i style={{ width: on ? `${BEFORE.score}%` : 0 }} /></div>
        <ul className="gx-tags">{BEFORE.missing.map((m) => <li key={m} className="is-miss">{m}</li>)}</ul>
      </div>
      <span className="gx-gauge-arrow" aria-hidden="true">→</span>
      <div className="gx-gauge-col is-after">
        <span className="gx-gauge-k">After Coach + Rewrite</span>
        <p className="gx-gauge-n">{after}<small>% match</small></p>
        <div className="gx-bar"><i style={{ width: on ? `${AFTER.score}%` : 0 }} /></div>
        <ul className="gx-tags">{BEFORE.missing.map((m) => <li key={m} className="is-ok">{m}</li>)}</ul>
      </div>
      <figcaption className="gx-gauge-cap">Illustrative example</figcaption>
    </figure>
  );
}
