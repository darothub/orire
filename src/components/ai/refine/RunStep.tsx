"use client";

import { useRefineStore, refineRunSignature } from "@/lib/store/refineStore";
import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { PROVIDERS } from "@/lib/ai/types";
import { countFacts } from "./shared";
import { Column } from "./Column";
import { JudgeBlock } from "./JudgeBlock";
import { ReviewChanges } from "./ReviewChanges";

export function RunStep({ onBack }: { onBack: () => void }) {
  const runProviders = useRefineStore((s) => s.runProviders);
  const started = useRefineStore((s) => s.started);
  const runSig = useRefineStore((s) => s.runSig);
  const revisited = useRefineStore((s) => s.revisited);
  const cols = useRefineStore((s) => s.cols);
  const runAll = useRefineStore((s) => s.runAll);
  const resetRun = useRefineStore((s) => s.resetRun);
  const keepResults = useRefineStore((s) => s.keepResults);
  const planBlock = useRefineStore((s) => s.planBlock);
  const usageNote = useRefineStore((s) => s.usageNote);
  const cv = useCVStore((s) => s.cv);
  const jd = useTargetStore((s) => s.jd);
  const appliedProvider = useRefineStore((s) => s.appliedProvider);
  const reviewProvider = useRefineStore((s) => s.reviewProvider);
  const openReview = useRefineStore((s) => s.openReview);
  const setView = useViewStore((s) => s.setView);

  const before = countFacts(cv);
  const anyRunning = runProviders.some((p) => cols[p].phase === "running");
  const single = runProviders.length === 1;
  // Results reflect the inputs captured at run time. We only prompt to re-run
  // when the user actually went back from Compare and changed something
  // (`revisited`) AND the inputs no longer match — a live edit on this screen
  // alone never nags. Even then the existing results stay visible: re-running
  // is offered alongside "keep these results".
  const stale =
    started &&
    revisited &&
    runSig !== null &&
    runSig !== refineRunSignature(runProviders, jd, cv);

  if (!started) {
    return (
      <div className="step-body">
        <div className="run-ready">
          <div className="run-ready-icon">✦</div>
          <strong>{single ? "Ready to tailor with " : "Ready to compare "}{runProviders.map((p) => PROVIDERS[p].label).join(" vs ")}</strong>
          <p>{single ? "One assistant will rewrite your CV for the role." : "Both assistants run in parallel on the same job — then Orire can pick the best version for you."}</p>
          <button className="flow-btn primary lg" onClick={() => void runAll()}>{single ? "Rewrite my CV" : "Run comparison"}</button>
          {planBlock && (
            <div className="plan-block" role="alert">
              <strong>{planBlock.title}</strong>
              <span>{planBlock.body}</span>
              <button className="flow-btn ghost sm" onClick={() => setView("plans")}>See plans</button>
            </div>
          )}
        </div>
        <div className="step-nav">
          <button className="flow-btn ghost" onClick={onBack}>Back</button>
        </div>
      </div>
    );
  }

  // Story 2: once the user chooses to apply a version, we interpose a
  // per-change review panel (before → after, accept/reject) in place of the
  // comparison grid. Nothing touches the CV until they confirm there.
  if (reviewProvider) {
    return (
      <div className="step-body">
        <ReviewChanges provider={reviewProvider} />
      </div>
    );
  }

  return (
    <div className="step-body">
      {usageNote && (
        <div className="usage-note" role="status">{usageNote}</div>
      )}
      {stale && (
        <div className="run-stale" role="alert">
          <span className="run-stale-ico" aria-hidden>↻</span>
          <div className="run-stale-text">
            <strong>Your inputs changed</strong>
            <span>You edited the assistants, job description, or CV after this comparison. Re-run so the results match, or keep the comparison you already have.</span>
          </div>
          <div className="run-stale-actions">
            <button className="flow-btn primary sm" onClick={() => void runAll()} disabled={anyRunning}>{single ? "Re-rewrite" : "Re-run comparison"}</button>
            <button className="flow-btn ghost sm" onClick={keepResults} disabled={anyRunning}>Keep these results</button>
          </div>
        </div>
      )}
      <div className={`cmp-grid ${single ? "single" : ""}`}>
        {runProviders.map((p) => (
          <Column
            key={p}
            provider={p}
            state={cols[p]}
            before={before}
            applied={appliedProvider === p}
            onReview={() => openReview(p)}
          />
        ))}
      </div>

      {appliedProvider && (
        <div className="cmp-applied-bar" role="status">
          <span className="cmp-applied-check">✓</span>
          <span>
            <strong>{PROVIDERS[appliedProvider].label}&apos;s version is now your CV.</strong> Open the editor to review or fine-tune it.
          </span>
          <button className="flow-btn primary sm" onClick={() => setView("edit")}>Open editor →</button>
        </div>
      )}

      <JudgeBlock />

      <div className="step-nav">
        <button className="flow-btn ghost" onClick={onBack} disabled={anyRunning}>Back</button>
        <button className="flow-btn" onClick={resetRun} disabled={anyRunning}>{anyRunning ? "Running…" : "New run"}</button>
      </div>
    </div>
  );
}
