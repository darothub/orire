"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CrossIcon, PlusIcon } from "./icons";

const CIRC = 2 * Math.PI * 50;
const CURRENT = 70;
const POTENTIAL = 93;
const DURATION_MS = 1400;

const GAPS = [
  { kind: "ok", label: "React + TypeScript — strong", icon: <CheckIcon /> },
  { kind: "part", label: "Design-system ownership — partial", icon: <PlusIcon /> },
  { kind: "miss", label: "Core Web Vitals — missing", icon: <CrossIcon /> },
  { kind: "miss", label: "Accessibility (WCAG) — missing", icon: <CrossIcon /> },
] as const;

/**
 * Hero visual: the simulated match for one role. The ring counts up once on
 * load and the gap list staggers in. It is an illustrative example, labelled
 * as such, and the final state is set immediately for reduced-motion users.
 */
export function HeroMatchCard() {
  const [pct, setPct] = useState(0);
  const [shown, setShown] = useState(0);
  const [bar, setBar] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (reduced) {
      raf = requestAnimationFrame(() => { setPct(CURRENT); setShown(GAPS.length); setBar(true); });
    } else {
      const start = setTimeout(() => {
        let t0 = 0;
        const step = (ts: number) => {
          t0 ||= ts;
          const p = Math.min((ts - t0) / DURATION_MS, 1);
          setPct(Math.round(CURRENT * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        GAPS.forEach((_, i) => timers.push(setTimeout(() => setShown(i + 1), 500 + i * 130)));
        timers.push(setTimeout(() => setBar(true), 700));
      }, 300);
      timers.push(start);
    }
    return () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
  }, []);

  return (
    <div className="lp-mcard" role="group" aria-label="Example match for a Senior Frontend Engineer role">
      <div className="lp-mcard-h">
        <div className="lp-co" aria-hidden="true">S</div>
        <div><b>Senior Frontend Engineer</b><span>Remote (EU)</span></div>
        <div className="lp-live"><i aria-hidden="true" />Simulating</div>
      </div>
      <div className="lp-mring">
        <div className="lp-ring" aria-hidden="true">
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--or-surface-2)" strokeWidth="11" />
            <circle
              cx="60" cy="60" r="50" fill="none" stroke="var(--or-match)" strokeWidth="11" strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct / 100)}
            />
          </svg>
          <div className="lp-ring-c"><b>{pct}%</b><span>match</span></div>
        </div>
        <ul className="lp-glist">
          {GAPS.map((g, i) => (
            <li key={g.label} className={`lp-gi${i < shown ? " is-in" : ""}`}>
              <span className={`lp-d ${g.kind}`}>{g.icon}</span>{g.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="lp-pbar" aria-hidden="true"><i style={{ width: bar ? `${POTENTIAL}%` : 0 }} /></div>
      <div className="lp-pscale"><span>Current {CURRENT}%</span><b>Potential {POTENTIAL}%</b></div>
      <span className="lp-ill">Illustrative example</span>
    </div>
  );
}
