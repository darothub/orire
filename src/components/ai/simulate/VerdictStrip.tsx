"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function coverageColor(v: number): string {
  const hue = Math.round((v / 100) * 130);
  return `hsl(${hue} 70% 45%)`;
}

const R = 26;
const C = 2 * Math.PI * R;

export interface VerdictStripProps {
  score: number;
  baseScore: number;
  matched: number;
  missing: number;
  /** Primary action(s) on the right of the strip. */
  actions?: ReactNode;
}

/** Sticky one-line summary: score, change since lock, counts, and the primary action. */
export function VerdictStrip({ score, baseScore, matched, missing, actions }: VerdictStripProps) {
  const delta = score - baseScore;
  return (
    <section className="sim-verdict" aria-label="Simulated match summary">
      <div className="sim-verdict-ring" aria-hidden>
        <svg viewBox="0 0 64 64" width="56" height="56">
          <circle cx="32" cy="32" r={R} className="rate-ring-track" />
          <motion.circle
            cx="32"
            cy="32"
            r={R}
            className="rate-ring-fill"
            stroke={coverageColor(score)}
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C * (1 - score / 100) }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </svg>
        <strong style={{ color: coverageColor(score) }}>{score}%</strong>
      </div>

      <div className="sim-verdict-main">
        <div className="sim-verdict-title">
          Simulated match
          <span className="sim-info" tabIndex={0} role="note" aria-label="About this score">
            i
            <span className="sim-info-pop">
              Orire compares your CV with an AI-generated example and signals from the job description. It is an
              illustrative benchmark, not an employer decision, ATS pass rate or interview prediction. Only include
              skills and achievements you actually have.
            </span>
          </span>
        </div>
        {delta !== 0 ? (
          <div className={`sim-verdict-delta ${delta > 0 ? "up" : "down"}`}>
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}% since locked
          </div>
        ) : (
          <div className="sim-verdict-delta">Baseline {baseScore}% when locked</div>
        )}
      </div>

      <div className="sim-verdict-counts">
        <span><b>{matched}</b> skills matched</span>
        <span><b>{missing}</b> to add</span>
      </div>

      {actions ? <div className="sim-verdict-actions">{actions}</div> : null}
    </section>
  );
}
