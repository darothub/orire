"use client";

import { SECTION_LABELS, type CVData, type SectionKey } from "@/lib/cv/schema";
import type { GapAnalysis } from "@/lib/ai/simulate";

export interface DiffViewProps {
  ideal: CVData;
  gap: GapAnalysis;
  onAddSkill: (skill: string) => void;
  onAddSection: (key: SectionKey) => void;
  onEdit: () => void;
}

/** Compact, scannable difference between the CV and the simulated target. */
export function DiffView({ ideal, gap, onAddSkill, onAddSection, onEdit }: DiffViewProps) {
  const missing = new Set<string>(gap.missingSections);

  return (
    <div className="sim-diff">
      <p className="sim-diff-note">
        <span className="sim-grounding">Simulated · not your facts</span>
        Red items are in the target but not in your CV. Add only what you genuinely have.
      </p>

      <section aria-label="Section differences">
        <h3 className="sim-diff-h">Sections</h3>
        <ul className="sim-diff-list">
          {ideal.order.map((k) => {
            const isMissing = missing.has(k);
            return (
              <li key={k} className={`sim-diff-row ${isMissing ? "miss" : "ok"}`}>
                <span className="sim-diff-mark" aria-hidden>{isMissing ? "✕" : "✓"}</span>
                <span className="sim-diff-name">{SECTION_LABELS[k]}</span>
                <span className="sim-diff-state">{isMissing ? "Missing" : "Covered"}</span>
                {isMissing ? (
                  <button className="sim-add" onClick={() => onAddSection(k)} aria-label={`Add ${SECTION_LABELS[k]} section`}>
                    Add
                  </button>
                ) : (
                  <button className="sim-add ghost" onClick={onEdit} aria-label={`Edit ${SECTION_LABELS[k]} in editor`}>
                    Edit
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Skill differences">
        <h3 className="sim-diff-h">
          Skills <span className="sim-seg-count">{gap.missingSkills.length} to add</span>
        </h3>
        <div className="sim-chips">
          {gap.missingSkills.map((s) => (
            <button key={s} className="sim-chip miss" onClick={() => onAddSkill(s)} title={`Add ${s} to my skills`}>
              + {s}
            </button>
          ))}
          {gap.matchedSkills.map((s) => (
            <span key={s} className="sim-chip match">✓ {s}</span>
          ))}
        </div>
      </section>
    </div>
  );
}
