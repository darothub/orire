"use client";

import { useEffect, useState } from "react";
import { simulateProgressAt } from "@/lib/ai/simulateProgress";

/** Estimated staged progress for an in-flight Simulate request. Mount it while
 *  the request runs; `startedAt` lets a second view join an existing run. */
export function SimulateProgress({ startedAt }: { startedAt?: number }) {
  const [t0] = useState(() => startedAt ?? Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 400);
    return () => window.clearInterval(id);
  }, []);

  const { percent, label, slow } = simulateProgressAt(now - t0);
  return (
    <div className="sim-progress" role="status" aria-live="polite">
      <div className="sim-progress-head">
        <span className="sim-progress-label">{label}</span>
        <span className="sim-progress-pct">{percent}%</span>
      </div>
      <div
        className="sim-progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Simulation progress"
      >
        <span className="sim-progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="sim-progress-note">
        {slow ? "Still working — longer job descriptions take more time." : "Estimated progress. This usually takes under a minute."}
      </p>
    </div>
  );
}
