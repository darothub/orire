"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { howItWorksSteps } from "@/components/landing/howItWorks";

const STEPS = howItWorksSteps();
const TITLES = ["Add your details", "Refine with AI", "Download your CV"];
const ADVANCE_MS = 5000;

const BEFORE = "Helped the team with the app redesign";
const AFTER = "Led the app redesign, lifting weekly active use by 34%";

/**
 * "How it works": three steps that drive a live CV. The server HTML shows the
 * finished CV; auto-advance starts after mount, stops once the visitor picks a
 * step, and never runs under reduced motion.
 */
export function HowStudio() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(STEPS.length - 1);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const id = setTimeout(() => {
      setActive(0);
      setAuto(true);
    }, 0);
    return () => clearTimeout(id);
  }, [reduced]);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setActive((i) => (i + 1) % STEPS.length), ADVANCE_MS);
    return () => clearInterval(id);
  }, [auto]);

  const pick = (i: number) => {
    setAuto(false);
    setActive(i);
  };

  return (
    <div className="hs">
      <ol className="hs-steps">
        {STEPS.map((step, i) => (
          <li key={step.n}>
            <button
              type="button"
              className={`hs-step${active === i ? " is-active" : ""}`}
              aria-current={active === i ? "step" : undefined}
              onClick={() => pick(i)}
            >
              <span className="hs-badge" aria-hidden="true">{step.n}</span>
              <span>
                <span className="hs-step-title">{TITLES[i]}</span>
                <span className="hs-step-body">{step.body}</span>
              </span>
              {auto && active === i && <i className="hs-progress" key={`p${active}`} aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ol>

      <div className="hs-paper" role="img" aria-label="A sample CV for Lola Lee, filling in as each step completes">
        <div className="hs-name">Lola Lee</div>
        <div className="hs-role">Product Designer · lola@example.com</div>
        <hr />
        <div className="hs-h">Experience</div>
        <div className={`hs-line${active >= 0 ? " on" : ""}`}>Senior Designer, Northwind · 2021 – now</div>
        <div className={`hs-bullet${active >= 1 ? " fixed" : ""}`}>
          <span className="hs-old">{BEFORE}</span>
          <span className="hs-new">{AFTER}</span>
        </div>
        <div className="hs-h">Skills</div>
        <div className={`hs-line${active >= 1 ? " on" : ""}`}>Figma · Research · Design systems</div>
        <div className={`hs-done${active >= 2 ? " on" : ""}`}>⇩ Lola_Lee_CV.pdf ready</div>
      </div>
    </div>
  );
}
