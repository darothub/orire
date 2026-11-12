"use client";

import { useCVStore } from "@/lib/store/cvStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { usePlanStore } from "@/lib/store/planStore";
import { useUsageStore } from "@/lib/store/usageStore";
import { useViewStore } from "@/lib/store/viewStore";
import { useRunAllStore } from "@/lib/store/runAllStore";
import { jdMatch } from "@/lib/ai/jdmatch";
import { allowRunAll, currentStep, RUN_STEPS, type RunStep } from "@/lib/tailor/runAll";

const score = () => {
  const { cv, started } = useCVStore.getState();
  const jd = useTargetStore.getState().jd;
  return started && jd.trim() ? jdMatch(cv, jd).score : 0;
};

/** Move to the next pending step, or stop on a cap or at the end. */
function goNext() {
  const { run, cap } = useRunAllStore.getState();
  const step = run && currentStep(run);
  if (!run || !step) {
    useViewStore.getState().setView("tailor");
    return;
  }
  const meta = RUN_STEPS.find((s) => s.step === step)!;
  if (useUsageStore.getState().exhausted(meta.metric)) {
    cap(step, score());
    useViewStore.getState().setView("tailor");
    return;
  }
  useViewStore.getState().setView(meta.view);
}

function finishStep(step: RunStep, status: "done" | "skipped") {
  useRunAllStore.getState().advance(step, status, score());
  goNext();
}

/** If a guided run is on the current tool's step, mark it done and open the next tool. */
export function advanceGuidedRun(): boolean {
  const { run } = useRunAllStore.getState();
  const step = run && currentStep(run);
  const meta = RUN_STEPS.find((s) => s.step === step);
  if (!step || !meta || meta.view !== useViewStore.getState().view) return false;
  finishStep(step, "done");
  return true;
}

/** Hub card: start a guided run, follow it, and see the before and after. */
export function RunAllPanel({ ready }: { ready: boolean }) {
  const plan = usePlanStore((s) => s.plan);
  const setView = useViewStore((s) => s.setView);
  const run = useRunAllStore((s) => s.run);
  const start = useRunAllStore((s) => s.start);
  const close = useRunAllStore((s) => s.close);
  const allowed = allowRunAll(plan);

  if (!run) {
    return (
      <section className="tailor-runall" aria-labelledby="tailor-runall-title">
        <h3 id="tailor-runall-title" className="tailor-tools-title">Run all</h3>
        <p className="tailor-sub">
          Diagnose, coach, then refine in one guided pass, and see your match before and after. Each step uses its own allowance
          (one diagnosis, one coach run, one refine run) and only when it runs. Skip any step for free. Nothing changes your CV until you accept it.
        </p>
        {allowed ? (
          <button type="button" className="flow-btn primary" disabled={!ready} onClick={() => { start(score()); goNext(); }}>
            Start guided run
          </button>
        ) : (
          <button type="button" className="flow-btn" onClick={() => setView("plans")}>Run all is a Pro feature. See plans</button>
        )}
        {allowed && !ready && <p className="tailor-sub">Add your CV and a job description first.</p>}
      </section>
    );
  }

  const step = currentStep(run);
  return (
    <section className="tailor-runall" aria-labelledby="tailor-runall-title">
      <h3 id="tailor-runall-title" className="tailor-tools-title">{step ? "Guided run" : "Run complete"}</h3>
      <ol className="tailor-runall-steps">
        {RUN_STEPS.map((s) => (
          <li key={s.step} data-status={run.statuses[s.step]}>
            {s.label}: {{ pending: "to do", done: "done", skipped: "skipped", capped: "stopped, monthly limit reached" }[run.statuses[s.step]]}
          </li>
        ))}
      </ol>
      {run.after !== null && (
        <p className="tailor-score" role="status">
          Match before: <strong>{run.before}%</strong>. Now: <strong>{run.after}%</strong>.
          <span className="tailor-note"> A keyword check, not an ATS score. Accepted changes are kept.</span>
        </p>
      )}
      <div className="step-nav">
        {step ? <button type="button" className="flow-btn primary" onClick={goNext}>Continue</button> : null}
        <button type="button" className="flow-btn ghost" onClick={close}>{step ? "Cancel run" : "Close"}</button>
      </div>
    </section>
  );
}

/** Slim bar shown above a tool while a guided run is on that tool's step. */
export function GuidedBar() {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const run = useRunAllStore((s) => s.run);
  const step = run && currentStep(run);
  const meta = RUN_STEPS.find((s) => s.step === step);
  if (!run || !step || !meta || meta.view !== view) return null;
  const n = RUN_STEPS.findIndex((s) => s.step === step) + 1;

  return (
    <div className="guided-bar" role="region" aria-label="Guided run">
      <span>Guided run, step {n} of {RUN_STEPS.length}: {meta.label}</span>
      <span className="guided-bar-actions">
        <button type="button" className="flow-btn" onClick={() => finishStep(step, "done")}>Done, next step</button>
        <button type="button" className="flow-btn ghost" onClick={() => finishStep(step, "skipped")}>Skip this step</button>
        <button type="button" className="tailor-link" onClick={() => setView("tailor")}>Back to Tailor</button>
      </span>
    </div>
  );
}
