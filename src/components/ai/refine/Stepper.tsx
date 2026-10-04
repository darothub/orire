"use client";

import { motion } from "framer-motion";
import { REFINE_STEPS, type RefineStep } from "@/lib/store/refineStore";

export const STEP_INDEX: Record<RefineStep, number> = { connect: 0, sources: 1, job: 2, run: 3 };

export function Stepper({ step, onJump }: { step: RefineStep; onJump: (s: RefineStep) => void }) {
  const active = STEP_INDEX[step];
  return (
    <nav className="stepper" aria-label="Refine steps">
      <div className="stepper-line">
        <motion.div
          className="stepper-line-fill"
          animate={{ width: `${(active / (REFINE_STEPS.length - 1)) * 100}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
      <div className="stepper-dots">
        {REFINE_STEPS.map((s, i) => {
          const state = i < active ? "done" : i === active ? "on" : "todo";
          const clickable = i < active; // only completed steps can be revisited
          return (
            <button
              key={s.key}
              type="button"
              className={`stepper-dot ${state} ${clickable ? "clickable" : ""}`}
              onClick={() => clickable && onJump(s.key)}
              disabled={!clickable}
              aria-current={state === "on" ? "step" : undefined}
              title={clickable ? `Go back to ${s.label}` : s.label}
            >
              <span className="stepper-bead">
                <span className="stepper-bead-num">{i + 1}</span>
                <span className="stepper-bead-mark">{clickable ? "↩" : "✓"}</span>
              </span>
              <span className="stepper-label">{s.label}</span>
              {clickable && <span className="stepper-edit">Edit</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
