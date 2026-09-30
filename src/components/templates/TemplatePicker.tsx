"use client";

import { useRef } from "react";
import {
  motion,
  MotionConfig,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { TEMPLATES, type TemplateMeta } from "./registry";
import type { CVData } from "@/lib/cv/schema";

/**
 * Cover-flow gallery of templates. Each card shows a real, scaled-down live
 * render of the current CV (req 3, 9) and reacts to the pointer with a subtle
 * 3D parallax tilt + a gradient sheen that tracks the cursor. The active card
 * keeps the shared `pick-ring` so selection stays legible.
 */
export function TemplatePicker() {
  const cv = useCVStore((s) => s.cv);
  const active = useCVStore((s) => s.activeTemplate);
  const setTemplate = useCVStore((s) => s.setTemplate);

  return (
    <div className="picker">
      <div className="picker-track">
        {TEMPLATES.map((t) => (
          <PickCard
            key={t.id}
            t={t}
            cv={cv}
            isActive={t.id === active}
            onSelect={() => setTemplate(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

const SPRING = { stiffness: 220, damping: 18, mass: 0.5 };

function PickCard({
  t,
  cv,
  isActive,
  onSelect,
}: {
  t: TemplateMeta;
  cv: CVData;
  isActive: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  // -0.5..0.5 pointer position within the card, springed for a fluid feel.
  const px = useSpring(useMotionValue(0), SPRING);
  const py = useSpring(useMotionValue(0), SPRING);

  const rotateY = useTransform(px, [-0.5, 0.5], [9, -9]);
  const rotateX = useTransform(py, [-0.5, 0.5], [-7, 7]);
  const sheenX = useTransform(px, [-0.5, 0.5], ["18%", "82%"]);
  const sheenY = useTransform(py, [-0.5, 0.5], ["12%", "88%"]);

  function onMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <motion.button
      ref={ref}
      layout
      initial={false}
      animate={{ scale: isActive ? 1.03 : 1 }}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={`pick-card ${isActive ? "is-active" : ""}`}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={onSelect}
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
        <PickSheen x={sheenX} y={sheenY} />
      </div>
      <div className="pick-meta">
        <span className="pick-name">{t.name}</span>
        <span className="pick-blurb">{t.blurb}</span>
      </div>
      {isActive && (
        <motion.span
          layoutId="pick-ring"
          className="pick-ring"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
    </motion.button>
  );
}

function PickSheen({ x, y }: { x: MotionValue<string>; y: MotionValue<string> }) {
  const background = useTransform(
    [x, y],
    ([bx, by]: string[]) =>
      `radial-gradient(120px 160px at ${bx} ${by}, rgba(255,255,255,0.28), rgba(255,255,255,0.05) 40%, transparent 68%)`
  );
  return <motion.span className="pick-sheen" aria-hidden style={{ background }} />;
}
