"use client";

import { useRefineStore } from "@/lib/store/refineStore";
import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";
import { countFacts } from "./shared";
import { Column } from "./Column";
import { JudgeBlock } from "./JudgeBlock";

export function RunStep({ onBack }: { onBack: () => void }) {
  const runProviders = useRefineStore((s) => s.runProviders);
  const started = useRefineStore((s) => s.started);
  const cols = useRefineStore((s) => s.cols);
  const runAll = useRefineStore((s) => s.runAll);
  const resetRun = useRefineStore((s) => s.resetRun);
  const planBlock = useRefineStore((s) => s.planBlock);
  const cv = useCVStore((s) => s.cv);
  const applyRefinedCV = useCVStore((s) => s.applyRefinedCV);
  const markApplied = useRefineStore((s) => s.markApplied);
  const appliedProvider = useRefineStore((s) => s.appliedProvider);
  const setView = useViewStore((s) => s.setView);

  const before = countFacts(cv);
  const anyRunning = runProviders.some((p) => cols[p].phase === "running");
  const single = runProviders.length === 1;

  const apply = (p: ProviderId) => {
    const r = cols[p].result;
    if (!r) return;
    applyRefinedCV(r.cv);
    markApplied(p);
  };

  if (!started) {
    return (
      <div className="step-body">
        <div className="run-ready">
          <div className="run-ready-icon">✦</div>
          <strong>{single ? "Ready to tailor with " : "Ready to compare "}{runProviders.map((p) => PROVIDERS[p].label).join(" vs ")}</strong>
          <p>{single ? "One assistant will rewrite your CV for the role." : "Both assistants run in parallel on the same job — then an LLM judge can pick the best."}</p>
          <button className="flow-btn primary lg" onClick={() => void runAll()}>{single ? "Refine my CV" : "Run comparison"}</button>
          {planBlock && (
            <div className="plan-block" role="alert">
              <strong>{planBlock.title}</strong>
              <span>{planBlock.body}</span>
              <button className="flow-btn ghost sm" onClick={() => setView("connect")}>See plans</button>
            </div>
          )}
        </div>
        <div className="step-nav">
          <button className="flow-btn ghost" onClick={onBack}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="step-body">
      <div className={`cmp-grid ${single ? "single" : ""}`}>
        {runProviders.map((p) => (
          <Column
            key={p}
            provider={p}
            state={cols[p]}
            before={before}
            applied={appliedProvider === p}
            onApply={() => apply(p)}
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

      <IdealBar />

      <JudgeBlock />

      <div className="step-nav">
        <button className="flow-btn ghost" onClick={onBack} disabled={anyRunning}>Back</button>
        <button className="flow-btn" onClick={resetRun} disabled={anyRunning}>{anyRunning ? "Running…" : "New run"}</button>
      </div>
    </div>
  );
}

function IdealBar() {
  const idealPhase = useRefineStore((s) => s.idealPhase);
  const idealErr = useRefineStore((s) => s.idealErr);
  const runSimulate = useRefineStore((s) => s.runSimulate);
  const cols = useRefineStore((s) => s.cols);
  const runProviders = useRefineStore((s) => s.runProviders);

  // Only meaningful once at least one refined result exists to compare against.
  const anyDone = runProviders.some((p) => cols[p].phase === "done" && cols[p].result);
  if (!anyDone) return null;

  return (
    <div className="ideal-bar">
      {idealPhase === "idle" && (
        <div className="ideal-bar-row">
          <div>
            <strong>Compare against a 100% match</strong>
            <span className="ideal-bar-sub">Simulate the ideal candidate for this role, then see the gap beside each result.</span>
          </div>
          <button className="flow-btn primary" onClick={() => void runSimulate()}>Simulate ideal</button>
        </div>
      )}
      {idealPhase === "running" && <div className="cmp-loading"><span className="cmp-spinner" /> Building the ideal candidate…</div>}
      {idealPhase === "error" && idealErr && (
        <div className="imp-error">
          <strong>{idealErr.title}{idealErr.status ? ` (HTTP ${idealErr.status})` : ""}</strong>
          <pre>{idealErr.body}</pre>
          <div className="imp-actions"><button className="flow-btn ghost" onClick={() => void runSimulate()}>Retry</button></div>
        </div>
      )}
      {idealPhase === "done" && (
        <div className="ideal-bar-done">✓ Ideal profile ready — gap shown in each column below the JD match.</div>
      )}
    </div>
  );
}
