"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { aiStudioRoles } from "@/components/landing/aiStudio";

const ROLES = aiStudioRoles();
const TYPE_MS = 16;
const CYCLE_MS = 7500;
const RING = 2 * Math.PI * 28;

/**
 * Hero demo: pick a target role and watch the AI rewrite one CV line for it.
 * Server HTML renders the finished state; typing/cycling only start after mount
 * and are skipped entirely under reduced motion.
 */
export function AiStudioHero() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState<number | null>(null);
  const [auto, setAuto] = useState(true);
  const role = ROLES[index];
  const shown = typed === null ? role.after : role.after.slice(0, typed);
  const done = typed === null || typed >= role.after.length;

  useEffect(() => {
    if (reduced) return;
    let n = 0;
    const id = setInterval(() => {
      n += 2;
      setTyped(Math.min(n, role.after.length));
      if (n >= role.after.length) clearInterval(id);
    }, TYPE_MS);
    return () => clearInterval(id);
  }, [index, role.after, reduced]);

  useEffect(() => {
    if (reduced || !auto) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % ROLES.length), CYCLE_MS);
    return () => clearInterval(id);
  }, [auto, reduced]);

  const pick = (i: number) => {
    setAuto(false);
    setTyped(0);
    setIndex(i);
  };

  return (
    <div className="lx-studio" role="group" aria-label="Interactive example: AI tailors a CV line to a chosen role">
      <div className="lx-studio-bar">
        <span className="lx-dot" /><span className="lx-dot" /><span className="lx-dot" />
        <span className="lx-studio-title">Orire AI · tailoring</span>
      </div>

      <div className="lx-roles" role="tablist" aria-label="Target role">
        {ROLES.map((r, i) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={i === index}
            className={`lx-role${i === index ? " is-active" : ""}`}
            onClick={() => pick(i)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <p className="lx-jd"><span>Reading the job</span>{role.jd}</p>

      <div className="lx-line lx-line-before">
        <span className="lx-tag">Your line</span>
        {role.before}
      </div>

      <div className="lx-line lx-line-after" aria-live="polite">
        <span className="lx-tag lx-tag-ai">✦ AI rewrite</span>
        {shown}
        {!done && <span className="lx-caret" aria-hidden="true" />}
      </div>

      <div className="lx-foot">
        <ul className="lx-keywords" aria-label="Keywords the rewrite emphasises">
          {role.keywords.map((k) => <li key={k}>{k}</li>)}
        </ul>
        <div className="lx-score" role="img" aria-label={`Illustrative role match ${role.match} percent`}>
          <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
            <circle cx="32" cy="32" r="28" className="lx-ring-bg" />
            <circle
              cx="32" cy="32" r="28" className="lx-ring"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - role.match / 100)}
            />
          </svg>
          <strong>{role.match}%</strong>
          <span>demo match</span>
        </div>
      </div>
    </div>
  );
}
