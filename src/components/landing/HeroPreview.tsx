"use client";

import { memo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { getTemplate } from "@/components/templates/registry";
import { demoTemplates } from "@/components/landing/demo";
import { plainCvLines } from "@/components/landing/plainCv";
import { sampleCV } from "@/lib/cv/sample";

const EASE = [0.22, 1, 0.36, 1] as const;

// Auto-play timeline (ms): rest on "Before", sweep right to reveal "After",
// rest on "After", then glide back to the start and repeat.
const HOLD_BEFORE = 1400;
const SWEEP_FORWARD = 3400;
const HOLD_AFTER = 2000;
const SWEEP_BACK = 1300;
const RESUME_DELAY = 1600;

type Phase = "holdBefore" | "forward" | "holdAfter" | "back" | "dragging" | "resumeWait";

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Static CV layers; memoised so the per-frame slider updates never re-render the template. */
const Layers = memo(function Layers() {
  const featured = demoTemplates()[0];
  const Component = getTemplate(featured.id).Component;
  const plain = plainCvLines(sampleCV);

  return (
    <>
      <pre className="landing-hero-plain" aria-hidden="true">{plain.join("\n")}</pre>
      <span className="landing-hero-chip landing-hero-chip-before">Before</span>

      <div className="landing-hero-after" data-hero-after aria-hidden="true">
        <div className="landing-hero-paper-scale">
          <div className="paper landing-hero-paper">
            <Component cv={sampleCV} />
          </div>
        </div>
        <span className="landing-hero-chip landing-hero-chip-after">After</span>
      </div>
    </>
  );
});

/**
 * Hero proof: the plain text CV ("Before") and the re-branded template Orire
 * produces ("After") in one frame. A handle sweeps left → right on a loop,
 * revealing the "After" as it goes; visitors can also drag it themselves.
 */
export function HeroPreview() {
  const featured = demoTemplates()[0];
  const frameRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  const phaseRef = useRef<Phase>("holdBefore");

  useEffect(() => {
    const frame = frameRef.current;
    const handle = handleRef.current;
    const after = frame?.querySelector<HTMLElement>("[data-hero-after]");
    if (!frame || !handle || !after) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const paint = (pos: number) => {
      posRef.current = pos;
      after.style.clipPath = `inset(0 ${100 - pos}% 0 0)`;
      handle.style.left = `${pos}%`;
    };

    let raf = 0;
    let phaseStart = performance.now();
    let from = 0;
    let backDuration = SWEEP_BACK;

    const setPhase = (phase: Phase, now: number) => {
      phaseRef.current = phase;
      phaseStart = now;
      from = posRef.current;
    };

    paint(reduceMotion ? 50 : 0);

    const tick = (now: number) => {
      const elapsed = now - phaseStart;
      switch (phaseRef.current) {
        case "holdBefore":
          paint(0);
          if (elapsed >= HOLD_BEFORE) setPhase("forward", now);
          break;
        case "forward":
          paint(100 * easeInOut(Math.min(1, elapsed / SWEEP_FORWARD)));
          if (elapsed >= SWEEP_FORWARD) setPhase("holdAfter", now);
          break;
        case "holdAfter":
          paint(100);
          if (elapsed >= HOLD_AFTER) {
            backDuration = SWEEP_BACK;
            setPhase("back", now);
          }
          break;
        case "back":
          paint(from * (1 - easeInOut(Math.min(1, elapsed / backDuration))));
          if (elapsed >= backDuration) setPhase("holdBefore", now);
          break;
        case "resumeWait":
          if (elapsed >= RESUME_DELAY) {
            backDuration = Math.max(300, (SWEEP_BACK * posRef.current) / 100);
            setPhase("back", now);
          }
          break;
        case "dragging":
          break;
      }
      raf = requestAnimationFrame(tick);
    };

    if (!reduceMotion) raf = requestAnimationFrame(tick);

    const moveTo = (clientX: number) => {
      const rect = frame.getBoundingClientRect();
      paint(clamp(((clientX - rect.left) / rect.width) * 100));
    };

    const onDown = (e: PointerEvent) => {
      phaseRef.current = "dragging";
      frame.setPointerCapture(e.pointerId);
      frame.classList.add("is-dragging");
      moveTo(e.clientX);
    };
    const onMove = (e: PointerEvent) => {
      if (phaseRef.current === "dragging") moveTo(e.clientX);
    };
    const onUp = (e: PointerEvent) => {
      if (phaseRef.current !== "dragging") return;
      frame.releasePointerCapture(e.pointerId);
      frame.classList.remove("is-dragging");
      if (!reduceMotion) setPhase("resumeWait", performance.now());
    };

    frame.addEventListener("pointerdown", onDown);
    frame.addEventListener("pointermove", onMove);
    frame.addEventListener("pointerup", onUp);
    frame.addEventListener("pointercancel", onUp);

    return () => {
      cancelAnimationFrame(raf);
      frame.removeEventListener("pointerdown", onDown);
      frame.removeEventListener("pointermove", onMove);
      frame.removeEventListener("pointerup", onUp);
      frame.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <motion.div
      className="landing-hero-visual"
      initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
      role="group"
      aria-label="Before and after comparison of a fictional example CV"
    >
      <div className="landing-hero-frame landing-hero-compare" ref={frameRef}>
        <Layers />
        <div className="landing-hero-handle" ref={handleRef} aria-hidden="true">
          <span className="landing-hero-handle-knob">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
            </svg>
          </span>
        </div>
      </div>

      <span className="landing-hero-frame-label">
        Fictional example: plain text becomes {/^[aeiou]/i.test(featured.name) ? "an" : "a"} <strong>{featured.name}</strong> CV. Drag to compare.
      </span>
    </motion.div>
  );
}
