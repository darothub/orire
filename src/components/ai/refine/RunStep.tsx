"use client";

import { useRefineStore, refineRunSignature } from "@/lib/store/refineStore";
import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { usePlanStore } from "@/lib/store/planStore";
import { useCoverLetterStore } from "@/lib/store/coverLetterStore";
import { allowCoverLetter, nextPlan } from "@/lib/plan/plan";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";
import { countFacts } from "./shared";
import { Column } from "./Column";
import { JudgeBlock } from "./JudgeBlock";

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
  const applyRefinedCV = useCVStore((s) => s.applyRefinedCV);
  const markApplied = useRefineStore((s) => s.markApplied);
  const appliedProvider = useRefineStore((s) => s.appliedProvider);
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
          <p>{single ? "One assistant will rewrite your CV for the role." : "Both assistants run in parallel on the same job — then Orire can pick the best version for you."}</p>
          <button className="flow-btn primary lg" onClick={() => void runAll()}>{single ? "Refine my CV" : "Run comparison"}</button>
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
            <button className="flow-btn primary sm" onClick={() => void runAll()} disabled={anyRunning}>{single ? "Re-refine" : "Re-run comparison"}</button>
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
  const cols = useRefineStore((s) => s.cols);
  const runProviders = useRefineStore((s) => s.runProviders);
  const setView = useViewStore((s) => s.setView);

  // Only meaningful once at least one refined result exists to build on.
  const anyDone = runProviders.some((p) => cols[p].phase === "done" && cols[p].result);
  if (!anyDone) return null;

  return (
    <div className="post-compare">
      <div className="post-compare-head">
        <span className="post-compare-step">Next</span>
        <h3>Go further in Simulate</h3>
        <p>You&apos;ve compared and picked a version. To push it further, head to Simulate — it benchmarks your CV against a synthetic 100%-match candidate, shows exactly what&apos;s missing, and can rewrite your CV in the target&apos;s voice, all without touching your facts.</p>
      </div>

      {/* Advisory → Simulate (D1). The benchmark/voice work now lives entirely in
          the Simulate workspace; it is no longer run inline here (D2). */}
      <div className="pc-card">
        <div className="pc-card-main">
          <strong>Benchmark &amp; enhance in Simulate</strong>
          <span className="pc-card-sub">
            See how close you are to the ideal candidate, close the gaps, and match the target&apos;s writing voice — all in the Simulate workspace.
          </span>
        </div>
        <button className="flow-btn primary" onClick={() => setView("target")}>Open Simulate →</button>
      </div>

      {/* Optional cover letter companion (Pro+). Fact-grounded on the CV. */}
      <CoverLetterCard />
    </div>
  );
}

function CoverLetterCard() {
  const plan = usePlanStore((s) => s.plan);
  const setView = useViewStore((s) => s.setView);
  const cv = useCVStore((s) => s.cv);
  const phase = useCoverLetterStore((s) => s.phase);
  const error = useCoverLetterStore((s) => s.error);
  const letter = useCoverLetterStore((s) => s.letter);
  const provider = useCoverLetterStore((s) => s.provider);
  const run = useCoverLetterStore((s) => s.runCoverLetter);

  const allowed = allowCoverLetter(plan);
  const running = phase === "running";

  if (!allowed) {
    const up = nextPlan("free");
    return (
      <div className="pc-card pc-upsell">
        <div className="pc-card-main">
          <strong>Add a tailored cover letter <span className="pc-pill">Pro</span></strong>
          <span className="pc-card-sub">
            Generate a cover letter written from your real CV and matched to this job — grounded in your facts, never invented. Available on {up?.label ?? "Pro"} and up.
          </span>
        </div>
        <button className="flow-btn ghost" onClick={() => setView("connect")}>See plans</button>
      </div>
    );
  }

  return (
    <div className={`pc-card cl-card${phase === "done" && letter ? " cl-open" : ""}`}>
      <div className="pc-card-main">
        <strong>Generate a cover letter{provider && phase === "done" ? ` · ${PROVIDERS[provider].label}` : ""}</strong>
        <span className="pc-card-sub">
          A concise letter tailored to this job, drawn only from your CV facts. {provider && phase === "running" ? `Using ${PROVIDERS[provider].label}…` : ""}
        </span>
      </div>

      {phase !== "done" && !running && (
        <button className="flow-btn primary" onClick={() => void run()}>
          {phase === "error" ? "Try again" : "Generate cover letter"}
        </button>
      )}
      {running && <div className="cmp-loading"><span className="cmp-spinner" /> Writing your cover letter…</div>}
      {phase === "error" && error && (
        <div className="imp-error">
          <strong>{error.title}{error.status ? ` (HTTP ${error.status})` : ""}</strong>
          <pre>{error.body}</pre>
        </div>
      )}

      {phase === "done" && letter && (
        <>
          <CoverLetterPreview letter={letter} name={cv.basics.fullName} title={cv.basics.title} contact={contactLine(cv)} />
          <div className="pc-gap-cta">
            <button className="flow-btn ghost sm" onClick={() => void run()}>Regenerate</button>
            <button className="flow-btn primary sm" onClick={() => setView("cover")}>Edit &amp; export →</button>
          </div>
        </>
      )}
    </div>
  );
}

function contactLine(cv: { basics: { email?: string; phone?: string; location?: string } }): string {
  return [cv.basics.email, cv.basics.phone, cv.basics.location].map((s) => (s ?? "").trim()).filter(Boolean).join("  ·  ");
}

function CoverLetterPreview({
  letter,
  name,
  title,
  contact,
}: {
  letter: import("@/lib/cv/coverLetter").CoverLetter;
  name: string;
  title: string;
  contact: string;
}) {
  const greeting = letter.meta.hiringManager?.trim()
    ? `Dear ${letter.meta.hiringManager.trim()},`
    : "Dear Hiring Team,";
  return (
    <div className="cl-sheet">
      <header className="cl-head">
        <strong>{name || "Your Name"}</strong>
        {title ? <span className="cl-title">{title}</span> : null}
        {contact ? <span className="cl-contact">{contact}</span> : null}
      </header>
      {(letter.meta.company || letter.meta.role) && (
        <div className="cl-to">
          {letter.meta.company ? <span>{letter.meta.company}</span> : null}
          {letter.meta.role ? <span>Re: {letter.meta.role}</span> : null}
        </div>
      )}
      <p className="cl-greeting">{greeting}</p>
      {letter.opening ? <p>{letter.opening}</p> : null}
      {letter.body.map((para, i) => (
        <p key={i}>{para}</p>
      ))}
      {letter.closing ? <p>{letter.closing}</p> : null}
      <p className="cl-signoff">
        {letter.signoff || "Sincerely,"}
        <br />
        {name || "Your Name"}
      </p>
    </div>
  );
}
