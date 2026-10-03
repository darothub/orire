"use client";

import { useTargetStore } from "@/lib/store/targetStore";

export function JobStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const jd = useTargetStore((s) => s.jd);
  const setJd = useTargetStore((s) => s.setJd);
  return (
    <div className="step-body">
      <p className="step-hint">Paste the full job description — shared across Refine, Simulate and Target. The assistant tailors your existing facts to match it — no invention.</p>
      <div className="ai-field">
        <span className="ed-label">Job description</span>
        <textarea
          className="ed-input ai-jd"
          value={jd}
          placeholder="Paste the full job description here…"
          onChange={(e) => setJd(e.target.value)}
          rows={12}
        />
      </div>
      <div className="step-nav">
        <button className="flow-btn ghost" onClick={onBack}>Back</button>
        <button className="flow-btn primary" onClick={onNext} disabled={!jd.trim()}>Continue</button>
      </div>
    </div>
  );
}
