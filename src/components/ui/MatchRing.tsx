"use client";

import { useEffect, useState } from "react";
import "./surfaces.css";

interface MatchRingProps {
  /** Match percentage, 0–100. */
  value: number;
  /** Ring colour: `gold` for a resting best-match, `match` for a fresh result. */
  tone?: "gold" | "match";
  /** Pixel diameter. Default 150. */
  size?: number;
  /** Small label under the number. Default "match". Pass "" to hide. */
  label?: string;
}

const R = 52;
const C = 2 * Math.PI * R;

/**
 * The signature match ring. On mount the ring fills and the number counts up
 * (~1.3s ease-out); `prefers-reduced-motion` jumps straight to the final value.
 */
export function MatchRing({ value, tone = "match", size = 150, label = "match" }: MatchRingProps) {
  const target = Math.max(0, Math.min(100, value));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let id = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // Jump to the final value on the next frame (not synchronously in the effect).
      id = requestAnimationFrame(() => setShown(target));
      return () => cancelAnimationFrame(id);
    }
    const dur = 1300;
    let t0: number | null = null;
    const step = (ts: number) => {
      if (t0 === null) t0 = ts;
      const p = Math.min((ts - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(target * eased);
      if (p < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [target]);

  const stroke = tone === "gold" ? "var(--or-gold)" : "var(--or-match)";
  const offset = C * (1 - shown / 100);
  return (
    <div
      className="or-ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(target)}% ${label || "match"}`}
    >
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--or-surface-2)" strokeWidth="11" />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={stroke}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="or-ring__c">
        <b className="or-ring__v" style={{ fontSize: size * 0.27 }}>
          {Math.round(shown)}%
        </b>
        {label && <span className="or-ring__l">{label}</span>}
      </div>
    </div>
  );
}
