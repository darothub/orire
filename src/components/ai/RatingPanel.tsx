"use client";

import { motion } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { scoreCV, diffScores, grade } from "@/lib/cv/rating";

/** Colour a 0–100 value from red → amber → green. */
function scoreColor(v: number): string {
  const hue = Math.round((v / 100) * 130); // 0=red, 130=green
  return `hsl(${hue} 70% 45%)`;
}

function Ring({ value, label, sub }: { value: number; label: string; sub?: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="rate-ring">
      <svg viewBox="0 0 84 84" width="84" height="84">
        <circle cx="42" cy="42" r={r} className="rate-ring-track" />
        <motion.circle
          cx="42"
          cy="42"
          r={r}
          className="rate-ring-fill"
          stroke={scoreColor(value)}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (value / 100) * c }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="rate-ring-center">
        <strong style={{ color: scoreColor(value) }}>{value}</strong>
      </div>
      <span className="rate-ring-label">{label}</span>
      {sub && <span className="rate-ring-sub">{sub}</span>}
    </div>
  );
}

export function RateView() {
  const cv = useCVStore((s) => s.cv);
  const baseline = useCVStore((s) => s.baseline);
  const started = useCVStore((s) => s.started);
  const captureBaseline = useCVStore((s) => s.captureBaseline);
  const clearBaseline = useCVStore((s) => s.clearBaseline);
  const setView = useViewStore((s) => s.setView);

  const current = scoreCV(cv);
  const diff = started && baseline ? diffScores(baseline, cv) : null;

  return (
    <motion.div
      className="ws-view rate-view"
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ws-head">
        <div>
          <h2>Grade</h2>
          <p>How your final CV scores against the initial — deterministic across six dimensions.</p>
        </div>
      </div>

        {!started ? (
          <div className="rate-hero solo">
            <Ring value={0} label="Rating" sub="—" />
            <p className="rate-note">
              No rating yet. Upload your first CV in <strong>Re-brand</strong> — your score is
              measured against the CV you bring in, so it starts at zero until then.
            </p>
          </div>
        ) : diff ? (
          <div className="rate-hero">
            <Ring value={diff.before} label="Initial" />
            <div className="rate-arrow">
              <span className={`rate-delta ${diff.diff > 0 ? "up" : diff.diff < 0 ? "down" : ""}`}>
                {diff.diff > 0 ? `+${diff.diff}` : diff.diff}
              </span>
              <span className="rate-arrow-glyph" aria-hidden>→</span>
            </div>
            <Ring value={diff.after} label="Final" sub={grade(diff.after)} />
          </div>
        ) : (
          <div className="rate-hero solo">
            <Ring value={current.overall} label="Current" sub={grade(current.overall)} />
            <p className="rate-note">
              No initial baseline saved yet. Refining or comparing with AI captures one
              automatically — or snapshot the current CV now to measure future edits against it.
            </p>
          </div>
        )}

        <div className="rate-metrics">
          {(diff
            ? diff.metrics
            : current.metrics.map((m) => ({ key: m.key, label: m.label, before: started ? m.value : 0, after: started ? m.value : 0, diff: 0 }))
          ).map((m) => {
            const meta = current.metrics.find((x) => x.key === m.key)!;
            return (
              <div key={m.key} className="rate-metric">
                <div className="rate-metric-head">
                  <span className="rate-metric-label">{m.label}</span>
                  <span className="rate-metric-nums">
                    {diff && (
                      <>
                        <span className="rate-before">{m.before}</span>
                        <span className="rate-arrow-sm">→</span>
                      </>
                    )}
                    <span className="rate-after" style={{ color: scoreColor(m.after) }}>{m.after}</span>
                    {diff && m.diff !== 0 && (
                      <span className={`rate-diff ${m.diff > 0 ? "up" : "down"}`}>
                        {m.diff > 0 ? `+${m.diff}` : m.diff}
                      </span>
                    )}
                  </span>
                </div>
                <span className="rate-track">
                  {diff && (
                    <span className="rate-fill-ghost" style={{ width: `${m.before}%` }} />
                  )}
                  <motion.span
                    className="rate-fill"
                    style={{ background: scoreColor(m.after) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${m.after}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </span>
                <span className="rate-metric-hint">{meta.hint}</span>
              </div>
            );
          })}
        </div>

        <div className="imp-actions rate-actions">
          {!started ? (
            <button className="imp-btn primary" onClick={() => setView("rebrand")}>Upload a CV</button>
          ) : baseline ? (
            <>
              <button className="imp-btn" onClick={clearBaseline}>Clear baseline</button>
              <button className="imp-btn" onClick={captureBaseline}>Reset baseline to current</button>
            </>
          ) : (
            <button className="imp-btn primary" onClick={captureBaseline}>Use current CV as baseline</button>
          )}
          <button className="imp-btn" onClick={() => setView("edit")}>Back to edit</button>
        </div>
    </motion.div>
  );
}
