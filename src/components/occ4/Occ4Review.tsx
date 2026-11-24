"use client";

import { useState } from "react";
import type { CVData } from "@/lib/cv/schema";
import type { OccAdvice } from "@/lib/occ/recommendations";
import { type CvField, cvFieldForEvidence } from "@/lib/occ/versionPatch";
import { CopilotCard } from "@/components/ui/CopilotCard";
import { Button } from "@/components/ui/Button";
import { Diff } from "@/components/ui/Diff";

const Spark = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--or-violet)" strokeWidth="2" aria-hidden>
    <path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.5 5.7 21l2.3-7.1-6-4.5h7.6z" />
  </svg>
);

const ASSESSMENT: Record<OccAdvice["recommendations"][number]["assessment"], { label: string; cls: string }> = {
  supported: { label: "Supported", cls: "occ4-badge--supported" },
  "needs-clarification": { label: "Needs clarification", cls: "occ4-badge--needs" },
  "not-found": { label: "Not found", cls: "occ4-badge--missing" },
};

/**
 * The CV review card, with Apply. Each supported rewrite that maps to a field
 * in the working draft gets an "Apply to my CV" button; applying writes the
 * approved wording into the draft (via onApply) and the preview + coverage move.
 * No draft (text-only paste) → suggestions render without Apply.
 */
export function Occ4Review({ advice, draft, onApply }: {
  advice: OccAdvice;
  draft: CVData | null;
  onApply: (field: CvField, replacement: string) => void;
}) {
  const [applied, setApplied] = useState<Set<number>>(new Set());

  // Map each recommendation to a draft field once, from the draft at render.
  const fields = advice.recommendations.map((r) =>
    draft && r.cvEvidence && r.sampleWording ? cvFieldForEvidence(draft, r.cvEvidence) : null,
  );
  const appliable = advice.recommendations
    .map((_, i) => i)
    .filter((i) => fields[i] && advice.recommendations[i].sampleWording && !applied.has(i));

  function apply(i: number) {
    const field = fields[i];
    const rec = advice.recommendations[i];
    if (!field || !rec.sampleWording || applied.has(i)) return;
    onApply(field, rec.sampleWording);
    setApplied((prev) => new Set(prev).add(i));
  }
  function applyAll() {
    appliable.forEach(apply);
  }

  return (
    <CopilotCard title="CV review" icon={<Spark />}>
      <p className="occ4-advice-summary">{advice.summary}</p>
      <div className="occ4-recs">
        {advice.recommendations.map((r, i) => (
          <div className="occ4-rec" key={i}>
            <div className="occ4-rec-head">
              <b>{r.requirement}</b>
              <span className={`occ4-badge ${ASSESSMENT[r.assessment].cls}`}>{ASSESSMENT[r.assessment].label}</span>
            </div>
            <p className="occ4-rec-sug">{r.suggestion}</p>
            {r.cvEvidence && r.sampleWording && (
              <Diff
                oldText={r.cvEvidence}
                newText={r.sampleWording}
                why="Evidence-only rewrite — verify before applying it to your CV."
              />
            )}
            {r.cvEvidence && r.sampleWording && fields[i] && (
              <div className="occ4-rec-apply">
                {applied.has(i) ? (
                  <span className="occ4-applied">✓ Applied to your draft</span>
                ) : (
                  <Button variant="gold" size="sm" onClick={() => apply(i)}>Apply to my CV</Button>
                )}
              </div>
            )}
            {r.question && <p className="occ4-rec-q">Q · {r.question}</p>}
          </div>
        ))}
      </div>
      {appliable.length > 1 && (
        <div className="occ4-rec-apply">
          <Button variant="primary" size="sm" onClick={applyAll}>Apply all suggested ({appliable.length})</Button>
        </div>
      )}
      {advice.nextSteps.length > 0 && (
        <div className="occ4-next">
          <b>Next steps</b>
          <ul>{advice.nextSteps.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
      <p className="occ4-disclaimer">{advice.disclaimer}</p>
      {!draft && (
        <p className="occ4-disclaimer">Import a CV (PDF or DOCX) to apply these rewrites straight into an editable draft.</p>
      )}
    </CopilotCard>
  );
}
