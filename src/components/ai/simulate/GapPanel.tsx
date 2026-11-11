"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { SECTION_LABELS, type SectionKey } from "@/lib/cv/schema";
import type { TargetMatch } from "@/lib/ai/simulate";
import type { RankedSection, RankedSkill } from "@/lib/ai/simulateImpact";
import { skillEvidence } from "@/lib/ai/simulateReport";
import type { CVData } from "@/lib/cv/schema";
import { coverageColor } from "./VerdictStrip";

type Tab = "skills" | "sections" | "signals";

export interface GapPanelProps {
  match: TargetMatch;
  cv: CVData;
  rankedSkills: RankedSkill[];
  rankedSections: RankedSection[];
  onAddSkill: (skill: string) => void;
  onAddSection: (key: SectionKey) => void;
}

const SKILL_PREVIEW = 6;

/** Tabbed gap view: only one lens is open at a time, so the screen stays quiet. */
export function GapPanel({ match, cv, rankedSkills, rankedSections, onAddSkill, onAddSection }: GapPanelProps) {
  const [tab, setTab] = useState<Tab>("skills");
  const [showAll, setShowAll] = useState(false);
  const { gap } = match;
  const missingSkills = showAll ? rankedSkills : rankedSkills.slice(0, SKILL_PREVIEW);
  const hidden = rankedSkills.length - missingSkills.length;
  const next = [
    ...rankedSkills.map((r) => ({ id: `s:${r.skill}`, label: r.skill, impact: r.impact, run: () => onAddSkill(r.skill) })),
    ...rankedSections.map((r) => ({ id: `c:${r.key}`, label: `${SECTION_LABELS[r.key]} section`, impact: r.impact, run: () => onAddSection(r.key) })),
  ]
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "skills", label: "Skills", count: gap.missingSkills.length },
    { key: "sections", label: "Sections", count: gap.missingSections.length },
    { key: "signals", label: "Signals" },
  ];

  return (
    <aside className="sim-gaps" aria-label="Gaps">
      <div className="sim-seg" role="tablist" aria-label="Gap view">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "on" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.count ? <span className="sim-seg-count">{t.count}</span> : null}
          </button>
        ))}
      </div>

      {next.length > 0 && next[0].impact > 0 && (
        <div className="sim-next" aria-label="Next best moves">
          <div className="sim-next-h">Next best moves</div>
          {next.map((n) => (
            <button key={n.id} className="sim-next-row" onClick={n.run} title="Add only if you genuinely have it">
              <span className="sim-next-box" aria-hidden />
              <span className="sim-gap-name">{n.label}</span>
              <span className="sim-impact">+{n.impact}%</span>
            </button>
          ))}
        </div>
      )}

      {tab === "skills" && (
        <div role="tabpanel">
          {gap.missingSkills.length === 0 ? (
            <p className="sim-perfect">You cover every skill in the target. 🎯</p>
          ) : (
            <>
              <p className="sim-gap-hint">Add only what you genuinely have.</p>
              <ul className="sim-gap-list">
                {missingSkills.map(({ skill: s, impact }) => (
                  <li key={s} className="sim-gap-row">
                    <span className="sim-gap-name">{s}</span>
                    {impact > 0 && <span className="sim-impact">+{impact}%</span>}
                    <button className="sim-add" onClick={() => onAddSkill(s)} aria-label={`Add ${s} to my skills`}>
                      Add
                    </button>
                  </li>
                ))}
              </ul>
              {hidden > 0 && (
                <button className="ai-link" onClick={() => setShowAll(true)}>Show {hidden} more</button>
              )}
              {showAll && rankedSkills.length > SKILL_PREVIEW && (
                <button className="ai-link" onClick={() => setShowAll(false)}>Show fewer</button>
              )}
            </>
          )}
          {gap.matchedSkills.length > 0 && (
            <details className="sim-matched">
              <summary>{gap.matchedSkills.length} matched</summary>
              <div className="sim-chips">
                {gap.matchedSkills.map((s) => {
                  const ev = skillEvidence(cv, s);
                  return (
                    <span key={s} className="sim-chip match" title={ev ? `Evidence: ${ev}` : "Listed in your skills"}>
                      {s}
                    </span>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}

      {tab === "sections" && (
        <div role="tabpanel">
          {gap.missingSections.length === 0 ? (
            <p className="sim-perfect">Your CV has every section the target has.</p>
          ) : (
            <ul className="sim-gap-list">
              {gap.missingSections.map((k) => (
                <li key={k} className="sim-gap-row">
                  <span className="sim-gap-name">{SECTION_LABELS[k as SectionKey]}</span>
                  {(rankedSections.find((r) => r.key === k)?.impact ?? 0) > 0 && (
                    <span className="sim-impact">+{rankedSections.find((r) => r.key === k)?.impact}%</span>
                  )}
                  <button
                    className="sim-add"
                    onClick={() => onAddSection(k as SectionKey)}
                    aria-label={`Add ${SECTION_LABELS[k as SectionKey]} section`}
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "signals" && (
        <div role="tabpanel" className="tgt-signals">
          {match.metrics.map((m) => (
            <div key={m.key} className="tgt-signal" title={m.hint}>
              <span className="tgt-signal-label">{m.label}</span>
              <span className="tgt-signal-bar">
                <motion.span
                  className="tgt-signal-fill"
                  style={{ background: coverageColor(m.score) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${m.score}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </span>
              <span className="tgt-signal-val">{m.score}%</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
