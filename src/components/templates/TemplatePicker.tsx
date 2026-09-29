"use client";

import { motion, MotionConfig } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { TEMPLATES } from "./registry";

/**
 * Horizontal gallery of templates. Each card shows a real, scaled-down live
 * render of the current CV so the preview is always truthful (req 3, 9).
 */
export function TemplatePicker() {
  const cv = useCVStore((s) => s.cv);
  const active = useCVStore((s) => s.activeTemplate);
  const setTemplate = useCVStore((s) => s.setTemplate);

  return (
    <div className="picker">
      <div className="picker-track">
        {TEMPLATES.map((t) => {
          const isActive = t.id === active;
          return (
            <motion.button
              key={t.id}
              layout
              initial={false}
              animate={{ scale: isActive ? 1.02 : 1 }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className={`pick-card ${isActive ? "is-active" : ""}`}
              onClick={() => setTemplate(t.id)}
              aria-pressed={isActive}
            >
              <span className="pick-swatch" style={{ background: t.swatch }} />
              <div className="pick-thumb" aria-hidden>
                <div className="pick-scale">
                  <div className="paper pick-paper">
                    <MotionConfig reducedMotion="always">
                      <t.Component cv={cv} />
                    </MotionConfig>
                  </div>
                </div>
              </div>
              <div className="pick-meta">
                <span className="pick-name">{t.name}</span>
                <span className="pick-blurb">{t.blurb}</span>
              </div>
              {isActive && (
                <motion.span layoutId="pick-ring" className="pick-ring" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
