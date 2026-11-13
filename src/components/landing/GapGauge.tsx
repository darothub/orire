"use client";

import { useEffect, useState } from "react";

const BEFORE = { score: 54, missing: ["Kubernetes", "CI/CD", "TDD"] };
const AFTER = { score: 91 };

/** Illustrative before/after match score — the promise of Simulate → Coach → Rewrite in one glance. */
export function GapGauge() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <figure className="gx-gauge" aria-label="Illustrative match score before and after">
      <div className="gx-gauge-col is-before">
        <span className="gx-gauge-k">Your CV · today</span>
        <p className="gx-gauge-n">{BEFORE.score}<small>% match</small></p>
        <div className="gx-bar"><i style={{ width: on ? `${BEFORE.score}%` : 0 }} /></div>
        <ul className="gx-tags">{BEFORE.missing.map((m) => <li key={m} className="is-miss">{m}</li>)}</ul>
      </div>
      <span className="gx-gauge-arrow" aria-hidden="true">→</span>
      <div className="gx-gauge-col is-after">
        <span className="gx-gauge-k">After Coach + Rewrite</span>
        <p className="gx-gauge-n">{AFTER.score}<small>% match</small></p>
        <div className="gx-bar"><i style={{ width: on ? `${AFTER.score}%` : 0 }} /></div>
        <ul className="gx-tags">{BEFORE.missing.map((m) => <li key={m} className="is-ok">{m}</li>)}</ul>
      </div>
      <figcaption className="gx-gauge-cap">Illustrative example</figcaption>
    </figure>
  );
}
