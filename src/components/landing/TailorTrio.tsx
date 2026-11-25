"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

const TABS = [
  {
    id: "simulate",
    kicker: "01 · Simulate · Diagnose",
    title: "See the gap",
    blurb: "Your CV against a synthetic 100% match. Scored, side by side.",
    caption: "Yours · Ideal · Side by side · Diff, every difference, one click away. The ideal is synthetic: a yardstick, never your CV.",
  },
  {
    id: "coach",
    kicker: "02 · Coach · Interview",
    title: "Fill it truthfully",
    blurb: "Targeted questions surface experience you forgot to write down.",
    caption: "Questions come only from what the role needs. Anything you can’t answer stays off your CV.",
  },
  {
    id: "rewrite",
    kicker: "03 · Rewrite · Polish",
    title: "Say it their way",
    blurb: "Re-voice your real experience in the role’s language. Diff every change.",
    caption: "Compare two AI providers, pick the winner, and accept changes line by line.",
  },
] as const;

const ROTATE_MS = 7000;

function Pane({ i }: { i: number }) {
  if (i === 0) {
    return (
      <div className="lp-two">
        <div className="lp-mini">
          <h4>Coverage by area</h4>
          <div className="lp-row">Backend &amp; APIs<span className="lp-badge is-hi">92%</span></div>
          <div className="lp-row">Testing (TDD/BDD)<span className="lp-badge is-lo">31%</span></div>
          <div className="lp-row">Cloud &amp; containers<span className="lp-badge is-mid">58%</span></div>
          <div className="lp-row">Delivery &amp; CI/CD<span className="lp-badge is-lo">22%</span></div>
        </div>
        <div className="lp-mini">
          <h4>What the ideal has that you don’t</h4>
          <ul className="lp-tags">
            {["Karate", "GitLab CI", "Kubernetes", "OpenShift"].map((m) => <li key={m} className="is-miss">{m}</li>)}
          </ul>
        </div>
      </div>
    );
  }
  if (i === 1) {
    return (
      <div className="lp-two">
        <div className="lp-mini">
          <h4>Question 2 of 5</h4>
          <p className="lp-q">The role needs automated testing. Have you written tests at your last job?</p>
          <p className="lp-ans">“Yes, JUnit suites for the payments service, around 400 cases.”</p>
          <p className="lp-verdict">✓ Grounded in your answer, added as a bullet.</p>
        </div>
        <div className="lp-mini">
          <h4>Already strong / not shown</h4>
          <div className="lp-row">Java, Spring Boot<span className="lp-badge is-hi">strong</span></div>
          <div className="lp-row">PostgreSQL<span className="lp-badge is-hi">strong</span></div>
          <div className="lp-row">OpenShift<span className="lp-badge is-lo">not shown, we won’t fake it</span></div>
        </div>
      </div>
    );
  }
  return (
    <div className="lp-two">
      <div className="lp-mini">
        <h4>Before → after</h4>
        <p className="lp-diff"><del>Responsible for backend services and testing.</del></p>
        <p className="lp-diff"><ins>Built Spring Boot services on PostgreSQL and a JUnit suite of ~400 tests.</ins></p>
      </div>
      <div className="lp-mini">
        <h4>Guardrails</h4>
        <div className="lp-row">New facts added<span className="lp-badge is-hi">0</span></div>
        <div className="lp-row">Numbers invented<span className="lp-badge is-hi">0</span></div>
        <div className="lp-row">Changes you can reject<span className="lp-badge is-hi">all</span></div>
      </div>
    </div>
  );
}

/** The product in three instruments. Each tab is a real, standalone Tailor tool. */
export function TailorTrio() {
  const reduced = useReducedMotion();
  const [cur, setCur] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reduced || paused) return;
    timer.current = setTimeout(() => setCur((c) => (c + 1) % TABS.length), ROTATE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [cur, paused, reduced]);

  return (
    <div className="lp-trio" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="lp-trio-tabs" role="tablist" aria-label="Simulate, Coach and Rewrite">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`lp-tab-${t.id}`}
            aria-selected={cur === i}
            aria-controls={`lp-pane-${t.id}`}
            className={`lp-tab${cur === i ? " is-on" : ""}`}
            onClick={() => setCur(i)}
          >
            <span className="lp-tab-k">{t.kicker}</span>
            <strong>{t.title}</strong>
            <span className="lp-tab-p">{t.blurb}</span>
            {cur === i && !reduced && !paused && <i key={`${cur}-p`} className="lp-prog" />}
          </button>
        ))}
      </div>
      <div className="lp-stage">
        {TABS.map((t, i) => (
          <div key={t.id} role="tabpanel" id={`lp-pane-${t.id}`} aria-labelledby={`lp-tab-${t.id}`} hidden={cur !== i} className="lp-pane">
            <Pane i={i} />
          </div>
        ))}
      </div>
      <p className="lp-caption" aria-live="polite">{TABS[cur].caption} <span className="lp-ill">Illustrative example.</span></p>
    </div>
  );
}
