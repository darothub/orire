"use client";

import { useState } from "react";
import type { CvChange } from "@/lib/ai/cvDiff";
import { CopilotCard } from "@/components/ui/CopilotCard";
import { Button } from "@/components/ui/Button";
import { Diff } from "@/components/ui/Diff";

const Spark = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--or-violet)" strokeWidth="2" aria-hidden>
    <path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.5 5.7 21l2.3-7.1-6-4.5h7.6z" />
  </svg>
);

/**
 * Refine review card — a full-CV, JD-tailored pass. Each proposed change can be
 * accepted or rejected; applying writes the accepted set into the working draft
 * (via onApply). Fact-grounded: changes only rephrase evidence already in the CV.
 */
export function Occ4Refine({ changes, onApply }: {
  changes: CvChange[];
  onApply: (rejected: Set<string>) => void;
}) {
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState(false);
  const accepted = changes.filter((c) => !rejected.has(c.id)).length;

  function toggle(id: string) {
    setRejected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <CopilotCard title="Refine — tailored to the JD" icon={<Spark />} tag={`${changes.length} change${changes.length === 1 ? "" : "s"}`}>
      <p className="occ4-advice-summary">
        A full-CV pass tailored to the role. Review each change, drop any you don&rsquo;t want, then apply the
        rest to your working draft.
      </p>
      {changes.map((c) => (
        <div className={`occ4-rec${rejected.has(c.id) ? " occ4-rec--off" : ""}`} key={c.id}>
          <div className="occ4-rec-head">
            <b>{c.label}</b>
            <button
              type="button"
              className={`occ4-refine-toggle${rejected.has(c.id) ? " off" : ""}`}
              aria-pressed={!rejected.has(c.id)}
              disabled={applied}
              onClick={() => toggle(c.id)}
            >
              {rejected.has(c.id) ? "Skipped" : "Accepted"}
            </button>
          </div>
          <Diff oldText={c.before.join("\n")} newText={c.after.join("\n")} why="Fact-grounded — rephrases evidence already in your CV." />
        </div>
      ))}
      <div className="occ4-rec-apply">
        {applied ? (
          <span className="occ4-applied">✓ Applied to your draft</span>
        ) : (
          <Button variant="gold" size="sm" disabled={accepted === 0} onClick={() => { onApply(rejected); setApplied(true); }}>
            Apply {accepted} change{accepted === 1 ? "" : "s"}
          </Button>
        )}
      </div>
      <p className="occ4-disclaimer">
        Refine never invents employers, dates or metrics — it only restructures and rephrases what&rsquo;s
        already in your CV. Verify before saving.
      </p>
    </CopilotCard>
  );
}
