"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { useCVStore } from "@/lib/store/cvStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { useUsageStore } from "@/lib/store/usageStore";
import { remainingNote } from "@/lib/plan/plan";
import { useStudioRefine } from "@/lib/v4/useStudioRefine";
import { useHydrated } from "@/lib/v4/useHydrated";
import { V4_COPILOT_HREF } from "@/lib/v4/nav";
import { V4ChangeList } from "./V4ChangeList";
import { V4Paper } from "./V4Paper";

/** Refine: rewrite the whole CV for one job description, then accept or skip each change. */
export function V4Refine() {
  const hydrated = useHydrated();
  const started = useCVStore((s) => s.started);
  const templateId = useCVStore((s) => s.activeTemplate);
  const label = useTargetStore((s) => s.label);
  const usage = useUsageStore((s) => s.summary?.metrics.refine);
  const refine = useStudioRefine();
  const { hasJob, running, review, skipped, message } = refine;

  if (hydrated && !started) {
    return (
      <div className="v4-empty-state">
        <b>No CV to refine yet</b>
        <p>Add your CV first, then tailor it to a job description.</p>
        <Link href={V4_COPILOT_HREF} className="v4-link">Open Copilot</Link>
      </div>
    );
  }

  const left = review ? review.changes.length - skipped.size : 0;
  return (
    <div className="v4-stack">
      <Card pad className="v4-refine-top" aria-label="Refine for a job">
        <div className="v4-refine-copy">
          <h2 className="v4-h2">{hasJob ? `Refine for ${label || "this job"}` : "Refine for a job"}</h2>
          <p className="v4-muted">Rewrites your whole CV for this role in one pass. Every change is checked against your real experience, and you accept or skip each one.</p>
          <div className="v4-pills">
            <Pill tone={hasJob ? "interview" : "neutral"}>{hasJob ? "Job description from your Simulate target" : "No job description yet"}</Pill>
            {usage && <Pill>{remainingNote("refine", usage.cap, usage.used)}</Pill>}
          </div>
        </div>
        <div className="v4-refine-actions">
          <Link href="/v4/studio/simulate" className="or-btn">{hasJob ? "Change job description" : "Add a job description"}</Link>
          <button type="button" className="or-btn gold" disabled={!hasJob || running} onClick={() => void refine.run()}>
            {running ? "Refining…" : "Run Refine"}
          </button>
        </div>
      </Card>

      {message && <p className="v4-muted" role="status">{message}</p>}

      {review && (
        <div className="v4-refine-review">
          <div className="v4-refine-changes">
            <div className="v4-refine-changes-head">
              <div>
                <h2 className="v4-h2">{review.changes.length} {review.changes.length === 1 ? "change" : "changes"} proposed</h2>
                <span className="v4-hint">Nothing changes in your CV until you apply.</span>
              </div>
              <div className="v4-refine-actions">
                <button type="button" className="or-btn" onClick={refine.acceptAll} disabled={skipped.size === 0}>Accept all</button>
                <button type="button" className="or-btn" onClick={refine.dismiss}>Dismiss</button>
              </div>
            </div>
            <V4ChangeList changes={review.changes} skipped={skipped} onToggle={refine.toggle} />
            <button type="button" className="or-btn gold v4-refine-apply" onClick={refine.apply} disabled={left === 0}>
              Apply {left} {left === 1 ? "change" : "changes"}
            </button>
          </div>
          <section className="v4-refine-after" aria-label="CV after the changes">
            <Pill tone="offer">After</Pill>
            <V4Paper cv={review.after} templateId={templateId} styled />
          </section>
        </div>
      )}
    </div>
  );
}
