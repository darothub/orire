"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

const TABS = [
  {
    id: "simulate",
    kicker: "01 · Simulate · Diagnose",
    title: "See the gap",
    blurb: "Your CV against a synthetic 100% match. Scored, side by side.",
    caption: "Yours · Ideal · Side by side · Diff — every difference, one click away. The ideal is synthetic: a yardstick, never your CV.",
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
      <div className="gx-two">
        <div className="gx-card">
          <h4>Coverage by area</h4>
          <p className="gx-row">Backend &amp; APIs<span className="gx-pill is-hi">92%</span></p>
          <p className="gx-row">Testing (TDD/BDD)<span className="gx-pill is-lo">31%</span></p>
          <p className="gx-row">Cloud &amp; containers<span className="gx-pill is-mid">58%</span></p>
          <p className="gx-row">Delivery &amp; CI/CD<span className="gx-pill is-lo">22%</span></p>
        </div>
        <div className="gx-card">
          <h4>What the ideal has that you don’t</h4>
          <ul className="gx-tags">
            {["Karate", "GitLab CI", "Kubernetes", "OpenShift"].map((m) => <li key={m} className="is-miss">{m}</li>)}
          </ul>
        </div>
      </div>
    );
  }
  if (i === 1) {
    return (
      <div className="gx-two">
        <div className="gx-card">
          <h4>Question 2 of 5</h4>
          <p className="gx-q">The role needs automated testing. Have you written tests at your last job?</p>
          <p className="gx-ans">“Yes — JUnit suites for the payments service, around 400 cases.”</p>
          <p className="gx-verdict">✓ Grounded in your answer — added as a bullet.</p>
        </div>
        <div className="gx-card">
          <h4>Already strong / not shown</h4>
          <p className="gx-row">Java, Spring Boot<span className="gx-pill is-hi">strong</span></p>
          <p className="gx-row">PostgreSQL<span className="gx-pill is-hi">strong</span></p>
          <p className="gx-row">OpenShift<span className="gx-pill is-lo">not shown — we won’t fake it</span></p>
        </div>
      </div>
    );
  }
  return (
    <div className="gx-two">
      <div className="gx-card">
        <h4>Before → after</h4>
        <p className="gx-diff"><del>Responsible for backend services and testing.</del></p>
        <p className="gx-diff"><ins>Built Spring Boot services on PostgreSQL and a JUnit suite of ~400 tests.</ins></p>
      </div>
      <div className="gx-card">
        <h4>Guardrails</h4>
        <p className="gx-row">New facts added<span className="gx-pill is-hi">0</span></p>
        <p className="gx-row">Numbers invented<span className="gx-pill is-hi">0</span></p>
        <p className="gx-row">Changes you can reject<span className="gx-pill is-hi">all</span></p>
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
    <div className="gx-trio" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="gx-tabs" role="tablist" aria-label="Simulate, Coach and Rewrite">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`gx-tab-${t.id}`}
            aria-selected={cur === i}
            aria-controls={`gx-pane-${t.id}`}
            className={`gx-tab${cur === i ? " is-on" : ""}`}
            onClick={() => setCur(i)}
          >
            <span className="gx-tab-k">{t.kicker}</span>
            <strong>{t.title}</strong>
            <span className="gx-tab-p">{t.blurb}</span>
            {cur === i && !reduced && !paused && <i key={`${cur}-p`} className="gx-prog" />}
          </button>
        ))}
      </div>
      <div className="gx-stage">
        {TABS.map((t, i) => (
          <div key={t.id} role="tabpanel" id={`gx-pane-${t.id}`} aria-labelledby={`gx-tab-${t.id}`} hidden={cur !== i} className="gx-pane">
            <Pane i={i} />
          </div>
        ))}
      </div>
      <p className="gx-caption" aria-live="polite">{TABS[cur].caption} <span className="gx-ill">Illustrative example.</span></p>
    </div>
  );
}
