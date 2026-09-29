"use client";

import { motion } from "framer-motion";
import { REFINE_STEPS, type RefineStep } from "@/lib/store/refineStore";

export const STEP_INDEX: Record<RefineStep, number> = { connect: 0, sources: 1, job: 2, run: 3 };

export function Stepper({ step, onJump }: { step: RefineStep; onJump: (s: RefineStep) => void }) {
  const active = STEP_INDEX[step];
  return (
    <div className="stepper">
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
          return (
            <button
              key={s.key}
              className={`stepper-dot ${state}`}
              onClick={() => i <= active && onJump(s.key)}
              disabled={i > active}
            >
              <span className="stepper-bead">{i < active ? "✓" : i + 1}</span>
              <span className="stepper-label">{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
