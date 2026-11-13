"use client";

import { motion } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { usePlanStore } from "@/lib/store/planStore";
import { VIEW_META } from "@/lib/store/viewMeta";
import { allowGradeBreakdown } from "@/lib/plan/plan";
import { scoreCV, diffScores, grade } from "@/lib/cv/rating";
import { getTemplate } from "@/components/templates/registry";
import { FitPaper } from "@/components/ai/simulate/ScaledPaper";

/** Colour a 0–100 value from red → amber → green. */
function scoreColor(v: number): string {
  const hue = Math.round((v / 100) * 130); // 0=red, 130=green
  return `hsl(${hue} 70% 45%)`;
}

function Ring({ value, label, sub, big }: { value: number; label: string; sub?: string; big?: boolean }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className={`rate-ring${big ? " big" : ""}`}>
      <div className="rate-ring-dial">
        <svg viewBox="0 0 84 84">
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
        <strong style={{ color: scoreColor(value) }}>{value}</strong>
      </div>
      <div className="rate-ring-text">
        <span className="rate-ring-label">{label}</span>
        {sub && <span className="rate-ring-sub">{sub}</span>}
      </div>
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
  const plan = usePlanStore((s) => s.plan);
  const showBreakdown = allowGradeBreakdown(plan);

  const activeTemplate = useCVStore((s) => s.activeTemplate);
  const Tpl = getTemplate(activeTemplate).Component;

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
          <h2>{VIEW_META.rate.label}</h2>
          <p>Your initial CV against where it stands now.</p>
        </div>
      </div>

        <aside className="score-disclosure" aria-label="How grading works">
          <span className="score-disclosure-icon" aria-hidden="true">i</span>
          <div>
            <p><strong>How grading works.</strong> This score reflects Orire’s fixed CV-writing rubric. It helps track edits; employers and applicant-tracking systems may evaluate your CV differently.</p>
          </div>
        </aside>

        {!started ? (
          <div className="rate-hero solo">
            <Ring value={0} label="Rating" sub="—" />
            <p className="rate-note">
              No rating yet. Upload your first CV in <strong>Re-brand</strong>: your score is
              measured against the CV you bring in, so it starts at zero until then.
            </p>
          </div>
        ) : diff ? null : (
          <div className="rate-hero solo">
            <Ring value={current.overall} label="Current" sub={grade(current.overall)} />
            <p className="rate-note">
              No initial baseline saved yet. Refining or comparing with AI captures one
              automatically, or snapshot the current CV now to measure future edits against it.
            </p>
          </div>
        )}

        {!diff && (
          <section className="rate-compare" aria-label="Current CV">
            <div className="rate-compare-head">
              <h3>Your CV, then and now</h3>
              <button className="flow-btn primary" onClick={captureBaseline}>Set this CV as my starting point</button>
            </div>
            <p className="rate-note">
              Save the CV as it is today. As you edit, Grade shows it side by side with this starting point.
            </p>
            <div className="tgt-split rate-split single">
              <div className="tgt-col">
                <div className="tgt-col-head ideal">
                  <span className="tgt-col-tag">Current</span>
                  <span className="tgt-col-sub">Score {current.overall} · {grade(current.overall)}</span>
                </div>
                <div className="tgt-paper-wrap">
                  <FitPaper><Tpl cv={cv} /></FitPaper>
                </div>
              </div>
            </div>
          </section>
        )}

        {started && baseline && diff && (
          <section className="rate-compare" aria-label="Initial and current CV">
            <div className="rate-versus" data-dir={diff.after > diff.before ? "up" : diff.after < diff.before ? "down" : "same"}>
              <div className="rate-side">
                <Ring value={diff.before} label="Initial" sub={grade(diff.before)} />
                <div className="tgt-paper-wrap">
                  <FitPaper><Tpl cv={baseline} /></FitPaper>
                </div>
              </div>
              <div className="rate-arrow rate-arrow-mid">
                <span className={`rate-delta ${diff.diff > 0 ? "up" : diff.diff < 0 ? "down" : ""}`}>
                  {diff.diff > 0 ? `+${diff.diff}` : diff.diff}
                </span>
                <span className="rate-arrow-glyph" aria-hidden>→</span>
              </div>
              <div className="rate-side">
                <Ring value={diff.after} label="Current" sub={grade(diff.after)} />
                <div className="tgt-paper-wrap">
                  <FitPaper><Tpl cv={cv} /></FitPaper>
                </div>
              </div>
            </div>
          </section>
        )}

        {!showBreakdown ? (
          <div className="rate-metrics-locked">
            <strong>See the full six-metric breakdown</strong>
            <span>
              You&apos;re seeing your overall score. Pro and Career unlock the per-dimension
              breakdown, relevance, impact, coverage, conciseness and more, so you can see
              exactly where to improve.
            </span>
            <button className="flow-btn primary" onClick={() => setView("plans")}>Upgrade to Pro</button>
          </div>
        ) : (
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
        )}

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
