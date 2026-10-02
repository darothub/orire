"use client";

import { motion } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { getTemplate } from "@/components/templates/registry";
import { gapAnalysis } from "@/lib/ai/simulate";
import { SECTION_LABELS, type SectionKey } from "@/lib/cv/schema";

function coverageColor(v: number): string {
  const hue = Math.round((v / 100) * 130);
  return `hsl(${hue} 70% 45%)`;
}

export function TargetView() {
  const cv = useCVStore((s) => s.cv);
  const activeTemplate = useCVStore((s) => s.activeTemplate);
  const setView = useViewStore((s) => s.setView);
  const ideal = useTargetStore((s) => s.ideal);
  const label = useTargetStore((s) => s.label);
  const createdAt = useTargetStore((s) => s.createdAt);
  const clearTarget = useTargetStore((s) => s.clearTarget);

  const MineTpl = getTemplate(activeTemplate).Component;

  if (!ideal) {
    return (
      <motion.div
        className="ws-view tgt-view"
        initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="ws-head">
          <div>
            <h2>Target</h2>
            <p>Lock an ideal CV from a job description, then edit your CV until it matches.</p>
          </div>
        </div>
        <div className="tgt-empty">
          <div className="tgt-empty-glyph" aria-hidden>🎯</div>
          <p>
            No target locked yet. Run <strong>Simulate a 100% match</strong>, then choose
            <strong> Lock as target</strong> to measure your CV against it here.
          </p>
          <button className="imp-btn primary" onClick={() => setView("simulate")}>Simulate a match</button>
        </div>
      </motion.div>
    );
  }

  const gap = gapAnalysis(cv, ideal);
  const IdealTpl = getTemplate(activeTemplate).Component;
  const dateLabel = createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";

  return (
    <motion.div
      className="ws-view tgt-view"
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ws-head">
        <div>
          <h2>Target</h2>
          <p>
            Your live CV beside the ideal for <strong>{label || "this role"}</strong>
            {dateLabel ? ` · locked ${dateLabel}` : ""}. The match updates as you edit.
          </p>
        </div>
      </div>

      <div className="tgt-meter">
        <div className="sim-cov">
          <svg viewBox="0 0 84 84" width="84" height="84" className="sim-cov-svg">
            <circle cx="42" cy="42" r="34" className="rate-ring-track" />
            <motion.circle
              cx="42"
              cy="42"
              r="34"
              className="rate-ring-fill"
              stroke={coverageColor(gap.coverage)}
              strokeDasharray={2 * Math.PI * 34}
              initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - gap.coverage / 100) }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </svg>
          <div className="sim-cov-center">
            <strong style={{ color: coverageColor(gap.coverage) }}>{gap.coverage}%</strong>
          </div>
          <span className="rate-ring-label">Match</span>
        </div>

        <div className="tgt-meter-body">
          <div className="tgt-stat-row">
            <span className="tgt-stat match">{gap.matchedSkills.length} matched</span>
            <span className="tgt-stat miss">{gap.missingSkills.length} to add</span>
            {gap.missingSections.length > 0 && (
              <span className="tgt-stat miss">{gap.missingSections.length} section{gap.missingSections.length > 1 ? "s" : ""} missing</span>
            )}
          </div>
          {gap.missingSkills.length > 0 ? (
            <div className="tgt-chips">
              {gap.missingSkills.slice(0, 18).map((s) => (
                <span key={s} className="sim-chip miss">{s}</span>
              ))}
              {gap.missingSkills.length > 18 && (
                <span className="sim-chip miss">+{gap.missingSkills.length - 18} more</span>
              )}
            </div>
          ) : (
            <p className="sim-perfect">You cover every skill in the target. 🎯</p>
          )}
          {gap.missingSections.length > 0 && (
            <div className="tgt-chips">
              {gap.missingSections.map((k) => (
                <span key={k} className="sim-chip miss">{SECTION_LABELS[k as SectionKey]}</span>
              ))}
            </div>
          )}
          <div className="tgt-actions">
            <button className="imp-btn primary" onClick={() => setView("edit")}>Edit my CV</button>
            <button className="imp-btn" onClick={() => setView("refine")}>Refine to JD</button>
            <button className="imp-btn" onClick={() => setView("simulate")}>New simulation</button>
            <button className="imp-btn danger" onClick={clearTarget}>Clear target</button>
          </div>
        </div>
      </div>

      <div className="tgt-split">
        <div className="tgt-col">
          <div className="tgt-col-head mine">
            <span className="tgt-col-tag">Yours</span>
            <span className="tgt-col-sub">{getTemplate(activeTemplate).name}</span>
          </div>
          <div className="tgt-paper-wrap">
            <div className="tgt-paper"><MineTpl cv={cv} /></div>
          </div>
        </div>

        <div className="tgt-col">
          <div className="tgt-col-head ideal">
            <span className="tgt-col-tag">Target · 100%</span>
            <span className="tgt-col-sub">Simulated · not your facts</span>
          </div>
          <div className="tgt-paper-wrap">
            <span className="sim-ribbon">TARGET</span>
            <div className="tgt-paper"><IdealTpl cv={ideal} /></div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
