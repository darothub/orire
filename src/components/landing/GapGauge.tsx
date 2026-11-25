"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BEFORE = { score: 54, missing: ["Kubernetes", "CI/CD", "TDD"] };
const AFTER = { score: 91 };

const R = 62;
const CIRC = 2 * Math.PI * R;
const DURATION_MS = 1600;

/**
 * Animates a score from `from` to `to` each time `runKey` changes while `run`
 * is true; resets to `from` when `run` turns false. State is only ever set from
 * animation-frame callbacks, never synchronously in the effect body.
 */
function useScoreSweep(from: number, to: number, run: boolean, runKey: number) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    if (!run) {
      const id = requestAnimationFrame(() => setValue(from));
      return () => cancelAnimationFrame(id);
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setValue(to));
      return () => cancelAnimationFrame(id);
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / DURATION_MS);
      setValue(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, run, runKey]);
  return value;
}

/**
 * Hero gauge: the signature match ring sweeping from today's score to the
 * score after Coach + Rewrite, with each missing term flipping from "missing"
 * to "closed" as it lands. Illustrative — labelled as such. Replays whenever it
 * scrolls back into view, or on demand.
 */
export function GapGauge() {
  const [inView, setInView] = useState(false);
  const [replays, setReplays] = useState(0);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const score = useScoreSweep(BEFORE.score, AFTER.score, inView, replays);
  const closed = score >= AFTER.score;
  const progress = (score - BEFORE.score) / (AFTER.score - BEFORE.score);
  // Replaying mid-view: briefly drop `inView` so the sweep restarts from today's score.
  const replay = useCallback(() => {
    setInView(false);
    requestAnimationFrame(() => {
      setInView(true);
      setReplays((n) => n + 1);
    });
  }, []);

  return (
    <figure ref={ref} className="lp-gauge" aria-label="Illustrative match score before and after">
      <div className="lp-gauge-head">
        <small>Match to role</small>
        <span className="lp-gauge-jd">JD · <b>Backend Engineer</b></span>
      </div>

      <div className="lp-gauge-body">
        <div className="lp-ring" aria-hidden="true">
          <svg viewBox="0 0 148 148">
            <circle cx="74" cy="74" r={R} fill="none" stroke="var(--or-surface-2)" strokeWidth="12" />
            <circle
              cx="74" cy="74" r={R} fill="none" stroke="var(--or-gold)" strokeWidth="12" strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - score / 100)}
            />
          </svg>
          <div className="lp-ring-c">
            <b className="lp-ring-v">{score}<span>%</span></b>
            <span className="lp-ring-l">match</span>
          </div>
        </div>
        <div className="lp-gauge-side" aria-hidden="true">
          <div className="lp-gauge-line"><span>Today</span><b>{BEFORE.score}%</b></div>
          <div className="lp-bar"><i style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} /></div>
          <div className="lp-gauge-line"><span>After Coach + Rewrite</span><b className="is-gold">{AFTER.score}%</b></div>
        </div>
      </div>

      {/* The sweep is decorative; this carries the same information once, statically. */}
      <p className="sr-only">
        Illustrative example: a CV scores {BEFORE.score}% against the role today and {AFTER.score}% after Coach and
        Rewrite, closing the gaps in {BEFORE.missing.join(", ")}.
      </p>

      <div className="lp-gaps" aria-hidden="true">
        <h4>{closed ? "Closed, grounded in your answers" : "Missing for this role"}</h4>
        <div>
          {BEFORE.missing.map((m) => (
            <span key={m} className={`lp-chip ${closed ? "is-ok" : "is-miss"}`}>{m}</span>
          ))}
        </div>
      </div>

      <div className="lp-gauge-foot">
        <figcaption className="lp-gauge-cap">Illustrative example</figcaption>
        <button type="button" className="lp-replay" onClick={replay} aria-label="Replay the match score animation">↻</button>
      </div>
    </figure>
  );
}
