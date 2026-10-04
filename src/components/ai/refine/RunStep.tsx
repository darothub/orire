"use client";

import { useRefineStore } from "@/lib/store/refineStore";
import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { targetMatch } from "@/lib/ai/simulate";
import { analyzeTone } from "@/lib/ai/retone";
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

      <JudgeBlock />

      <PostCompare />

      <div className="step-nav">
        <button className="flow-btn ghost" onClick={onBack} disabled={anyRunning}>Back</button>
        <button className="flow-btn" onClick={resetRun} disabled={anyRunning}>{anyRunning ? "Running…" : "New run"}</button>
      </div>
    </div>
  );
}

function PostCompare() {
  const idealPhase = useRefineStore((s) => s.idealPhase);
  const idealErr = useRefineStore((s) => s.idealErr);
  const runSimulate = useRefineStore((s) => s.runSimulate);
  const cols = useRefineStore((s) => s.cols);
  const runProviders = useRefineStore((s) => s.runProviders);
  const appliedProvider = useRefineStore((s) => s.appliedProvider);
  const cv = useCVStore((s) => s.cv);
  const target = useTargetStore((s) => s.ideal);
  const jd = useTargetStore((s) => s.jd);
  const targetLabel = useTargetStore((s) => s.label);
  const setView = useViewStore((s) => s.setView);

  // Only meaningful once at least one refined result exists to benchmark.
  const anyDone = runProviders.some((p) => cols[p].phase === "done" && cols[p].result);
  if (!anyDone) return null;

  const running = idealPhase === "running";
  const gap = target ? targetMatch(cv, target, jd) : null;
  const voice = target ? analyzeTone(target).label : null;

  return (
    <div className="post-compare">
      <div className="post-compare-head">
        <span className="post-compare-step">Next</span>
        <h3>Benchmark &amp; voice</h3>
        <p>You&apos;ve compared and judged. Now see how close your CV is to the perfect candidate — and optionally match the target&apos;s writing voice.</p>
      </div>

      {/* 1 · Simulate the ideal candidate — a gap benchmark, not your facts. */}
      <div className="pc-card">
        <div className="pc-card-main">
          <strong>How close are you to the ideal candidate?</strong>
          <span className="pc-card-sub">
            Simulate builds a synthetic CV that would be a 100% match for this role, then measures the gap against your CV. It&apos;s a benchmark — never written into your facts.
          </span>
        </div>

        {!target && idealPhase === "idle" && (
          <button className="flow-btn primary" onClick={() => void runSimulate()}>Simulate the ideal</button>
        )}
        {running && <div className="cmp-loading"><span className="cmp-spinner" /> Building the ideal candidate…</div>}
        {idealPhase === "error" && idealErr && (
          <div className="imp-error">
            <strong>{idealErr.title}{idealErr.status ? ` (HTTP ${idealErr.status})` : ""}</strong>
            <pre>{idealErr.body}</pre>
            <div className="imp-actions"><button className="flow-btn ghost" onClick={() => void runSimulate()}>Retry</button></div>
          </div>
        )}

        {target && gap && !running && (
          <div className="pc-gap">
            <div className="pc-gap-score" title="How much of the ideal candidate your CV currently covers">
              <strong>{gap.score}%</strong>
              <span>to ideal{targetLabel ? ` · ${targetLabel}` : ""}</span>
            </div>
            <div className="pc-gap-stats">
              <span className="tgt-stat match">{gap.gap.matchedSkills.length} skills matched</span>
              <span className="tgt-stat miss">{gap.gap.missingSkills.length} to add</span>
            </div>
            <div className="pc-gap-cta">
              <button className="flow-btn sm" onClick={() => setView("target")}>Open Target →</button>
              <button className="flow-btn ghost sm" onClick={() => void runSimulate()}>Re-simulate</button>
            </div>
          </div>
        )}
      </div>

      {/* 2 · Rewrite the chosen CV in the target's voice (needs a target). */}
      {target && (
        <div className="pc-card">
          <div className="pc-card-main">
            <strong>Rewrite in the target&apos;s voice{voice ? ` · ${voice}` : ""}</strong>
            <span className="pc-card-sub">
              {appliedProvider
                ? `Rewrite ${PROVIDERS[appliedProvider].label}'s version in the target's voice — your employers, dates, numbers and skills stay exactly as they are.`
                : "Apply a winner (or any column above) to pick the CV you want, then rewrite it in the target's voice. Your facts always stay yours."}
            </span>
          </div>
          <button className="flow-btn accent" onClick={() => setView("target")} title="Opens your CV beside the target, with the tone studio ready">
            ✍️ Rewrite voice →
          </button>
        </div>
      )}
    </div>
  );
}
