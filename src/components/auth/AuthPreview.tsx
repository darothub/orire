"use client";

import { useEffect, useState } from "react";

const SAMPLES = [
  { role: "Product Designer", score: 92 },
  { role: "Software Engineer", score: 88 },
  { role: "Marketing Manager", score: 95 },
] as const;

const SKILL_BARS = [0, 1, 2];

/** Decorative, rotating sample CV with a match ring. Purely illustrative. */
export function AuthPreview() {
  const [i, setI] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let swap: ReturnType<typeof setTimeout> | undefined;
    const tick = setInterval(() => {
      setFading(true);
      swap = setTimeout(() => {
        setI((n) => (n + 1) % SAMPLES.length);
        setFading(false);
      }, 350);
    }, 4200);
    return () => {
      clearInterval(tick);
      if (swap) clearTimeout(swap);
    };
  }, []);

  const s = SAMPLES[i];
  return (
    <div className="auth-preview" aria-hidden>
      <div className={`auth-preview-cv ${fading ? "is-fading" : ""}`}>
        <div className="auth-preview-top">
          <div>
            <b>Lola Lee</b>
            <small>{s.role}</small>
          </div>
          <div className="auth-preview-ring" style={{ ["--p" as string]: s.score }}>
            <i>{s.score}</i>
          </div>
        </div>
        {SKILL_BARS.map((b) => (
          <div key={b} className="auth-preview-bar">
            <i style={{ animationDelay: `${b * 0.6}s` }} />
          </div>
        ))}
        <span className="auth-preview-tag">Sample</span>
      </div>
      <div className={`auth-preview-badge ${fading ? "is-fading" : ""}`}>Match {s.score}% ▲</div>
    </div>
  );
}
