"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRefineStore, REFINE_STEPS, type RefineStep, type ColState } from "@/lib/store/refineStore";
import { useCVStore, type ImportMode } from "@/lib/store/cvStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useViewStore } from "@/lib/store/viewStore";
import { ProviderSetup } from "@/components/ai/ProviderSetup";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";
import type { ParsedCV } from "@/lib/ingest/parse";
import { SECTION_LABELS, type CVData, type SectionKey } from "@/lib/cv/schema";
import type { JDMatch } from "@/lib/ai/jdmatch";
import { gapAnalysis, type GapAnalysis } from "@/lib/ai/simulate";

const STEP_INDEX: Record<RefineStep, number> = { connect: 0, sources: 1, job: 2, run: 3 };

const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 40 : -40, filter: "blur(6px)" }),
  center: { opacity: 1, x: 0, filter: "blur(0px)" },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -40 : 40, filter: "blur(6px)" }),
};

function countFacts(cv: CVData) {
  return {
    experience: cv.experience.length,
    education: cv.education.length,
    projects: cv.projects.length,
    certifications: cv.certifications.length,
    skills: cv.skills.reduce((a, g) => a + g.items.length, 0),
  };
}

export function RefineFlow() {
  const step = useRefineStore((s) => s.step);
  const setStep = useRefineStore((s) => s.setStep);
  const reset = useRefineStore((s) => s.reset);
  const [dir, setDir] = useState(1);

  const go = (next: RefineStep) => {
    setDir(STEP_INDEX[next] >= STEP_INDEX[step] ? 1 : -1);
    setStep(next);
  };

  return (
    <div className="ws-view refine-flow">
      <div className="ws-head">
        <div>
          <h2>Refine to a job</h2>
          <p>Connect an assistant, bring your CVs, add the role — then compare tailored results. Only your own facts are used.</p>
        </div>
        <button className="ws-reset" onClick={reset} title="Start the flow over">Restart</button>
      </div>

      <Stepper step={step} onJump={go} />

      <div className="refine-stage">
        <AnimatePresence mode="popLayout" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="refine-step"
          >
            {step === "connect" && <ConnectStep onNext={() => go("sources")} />}
            {step === "sources" && <SourcesStep onBack={() => go("connect")} onNext={() => go("job")} />}
            {step === "job" && <JobStep onBack={() => go("sources")} onNext={() => go("run")} />}
            {step === "run" && <RunStep onBack={() => go("job")} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Stepper({ step, onJump }: { step: RefineStep; onJump: (s: RefineStep) => void }) {
  const active = STEP_INDEX[step];
  return (
    <div className="stepper">
      <div className="stepper-line">
        <motion.div
          className="stepper-line-fill"
          animate={{ width: `${(active / (REFINE_STEPS.length - 1)) * 100}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
      <div className="stepper-dots">
        {REFINE_STEPS.map((s, i) => {
          const state = i < active ? "done" : i === active ? "on" : "todo";
          return (
            <button
              key={s.key}
              className={`stepper-dot ${state}`}
              onClick={() => i <= active && onJump(s.key)}
              disabled={i > active}
            >
              <span className="stepper-bead">{i < active ? "✓" : i + 1}</span>
              <span className="stepper-label">{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Step 1: Connect ---------------- */
function ConnectStep({ onNext }: { onNext: () => void }) {
  const runProviders = useRefineStore((s) => s.runProviders);
  const keys = useSettingsStore((s) => s.keys);
  const selectedMissingKey = runProviders.filter((p) => !keys[p]?.trim());
  const ready = runProviders.length >= 1 && selectedMissingKey.length === 0;

  return (
    <div className="step-body">
      <p className="step-hint">
        Select <strong>one</strong> assistant for a single tailored pass, or <strong>two</strong> to run them in
        parallel and compare. Keys stay in this browser and go only to the provider you pick.
      </p>
      <ProviderSetup selectable />
      <div className="step-nav">
        <span className="step-note">
          {runProviders.length === 0
            ? "Select at least one assistant to continue."
            : selectedMissingKey.length > 0
              ? `Add a key for ${selectedMissingKey.map((p) => PROVIDERS[p].label).join(" & ")}.`
              : runProviders.length === 1
                ? "1 assistant — single tailored pass."
                : "2 assistants — parallel compare + judge."}
        </span>
        <button className="flow-btn primary" onClick={onNext} disabled={!ready}>Continue</button>
      </div>
    </div>
  );
}

/* ---------------- Step 2: Sources (import) ---------------- */
interface FileResult {
  name: string;
  size: number;
  kind: "pdf" | "docx" | "unsupported";
  text: string;
  parsed: ParsedCV | null;
  error: string | null;
}
function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function SourcesStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const cv = useCVStore((s) => s.cv);
  const applyImport = useCVStore((s) => s.applyImport);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<FileResult[] | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const facts = countFacts(cv);
  const hasContent = facts.experience + facts.education + facts.skills + facts.projects > 0;

  const upload = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true); setFatal(null); setResults(null); setApplied(null);
    try {
      const fd = new FormData();
      for (const f of list) fd.append("files", f);
      const res = await fetch("/api/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setFatal(data?.error ? String(data.error) : `Request failed (HTTP ${res.status}).`); return; }
      setResults(data.files as FileResult[]);
    } catch (e) {
      setFatal(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
  }, [upload]);

  const apply = (r: FileResult, mode: ImportMode) => {
    if (!r.parsed) return;
    applyImport(r.parsed, mode);
    setApplied(`${r.name} — ${mode === "replace" ? "replaced" : "appended"}`);
  };

  return (
    <div className="step-body">
      <p className="step-hint">
        Upload one or more existing CVs (PDF or DOCX). We extract the text and map it into your working CV — the
        source of facts for refining. Already have a CV in the editor? You can skip this.
      </p>

      <div
        className={`imp-drop ${dragOver ? "over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          hidden
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
        <div className="imp-drop-inner">
          <span className="imp-drop-ico">⇪</span>
          <strong>{dragOver ? "Drop to upload" : "Drag & drop, or click to choose files"}</strong>
          <span className="imp-drop-sub">PDF · DOCX · multiple allowed</span>
        </div>
      </div>

      {busy && <div className="imp-busy">Extracting text…</div>}
      {fatal && <div className="imp-error"><strong>Upload failed</strong><pre>{fatal}</pre></div>}

      <AnimatePresence>
        {applied && (
          <motion.div className="imp-applied" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            Applied: {applied}.
          </motion.div>
        )}
      </AnimatePresence>

      {results && (
        <div className="imp-results">
          {results.map((r, i) => (
            <motion.div key={`${r.name}-${i}`} className="imp-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="imp-card-top">
                <span className={`imp-badge ${r.kind}`}>{r.kind.toUpperCase()}</span>
                <span className="imp-name" title={r.name}>{r.name}</span>
                <span className="imp-meta">{fmtSize(r.size)}</span>
              </div>
              {r.error ? (
                <div className="imp-error"><strong>Could not parse this file</strong><pre>{r.error}</pre></div>
              ) : r.parsed ? (
                <>
                  <div className="imp-summary">
                    <Chip label="Name" value={r.parsed.basics.fullName} />
                    <Chip label="Title" value={r.parsed.basics.title} />
                    <Stat label="Experience" n={r.parsed.experience.length} />
                    <Stat label="Education" n={r.parsed.education.length} />
                    <Stat label="Skills" n={r.parsed.skills.reduce((a, g) => a + g.items.length, 0)} />
                  </div>
                  <div className="imp-actions">
                    <button className="imp-btn primary" onClick={() => apply(r, "replace")}>Replace editor</button>
                    <button className="imp-btn" onClick={() => apply(r, "merge")}>Append</button>
                  </div>
                </>
              ) : null}
            </motion.div>
          ))}
        </div>
      )}

      <div className="src-current">
        <span className="ed-label">Working CV</span>
        <div className="src-chips">
          <span className={facts.experience ? "" : "zero"}>{facts.experience} experience</span>
          <span className={facts.education ? "" : "zero"}>{facts.education} education</span>
          <span className={facts.skills ? "" : "zero"}>{facts.skills} skills</span>
          <span className={facts.projects ? "" : "zero"}>{facts.projects} projects</span>
        </div>
      </div>

      <div className="step-nav">
        <button className="flow-btn ghost" onClick={onBack}>Back</button>
        <button className="flow-btn primary" onClick={onNext}>
          {hasContent ? "Continue" : "Skip — use current CV"}
        </button>
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return <span className="imp-kv"><em>{label}</em>{value}</span>;
}
function Stat({ label, n }: { label: string; n: number }) {
  return <span className={`imp-kv ${n === 0 ? "zero" : ""}`}><em>{label}</em>{n}</span>;
}

/* ---------------- Step 3: Job description ---------------- */
function JobStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const jd = useRefineStore((s) => s.jd);
  const setJd = useRefineStore((s) => s.setJd);
  return (
    <div className="step-body">
      <p className="step-hint">Paste the full job description. The assistant tailors your existing facts to match it — no invention.</p>
      <div className="ai-field">
        <span className="ed-label">Job description</span>
        <textarea
          className="ed-input ai-jd"
          value={jd}
          placeholder="Paste the full job description here…"
          onChange={(e) => setJd(e.target.value)}
          rows={12}
        />
      </div>
      <div className="step-nav">
        <button className="flow-btn ghost" onClick={onBack}>Back</button>
        <button className="flow-btn primary" onClick={onNext} disabled={!jd.trim()}>Continue</button>
      </div>
    </div>
  );
}

/* ---------------- Step 4: Run / Compare / Judge ---------------- */
function RunStep({ onBack }: { onBack: () => void }) {
  const runProviders = useRefineStore((s) => s.runProviders);
  const started = useRefineStore((s) => s.started);
  const cols = useRefineStore((s) => s.cols);
  const runAll = useRefineStore((s) => s.runAll);
  const resetRun = useRefineStore((s) => s.resetRun);
  const cv = useCVStore((s) => s.cv);
  const applyRefinedCV = useCVStore((s) => s.applyRefinedCV);
  const setView = useViewStore((s) => s.setView);

  const before = countFacts(cv);
  const anyRunning = runProviders.some((p) => cols[p].phase === "running");
  const single = runProviders.length === 1;

  const apply = (p: ProviderId) => {
    const r = cols[p].result;
    if (!r) return;
    applyRefinedCV(r.cv);
    setView("edit");
  };

  if (!started) {
    return (
      <div className="step-body">
        <div className="run-ready">
          <div className="run-ready-icon">✦</div>
          <strong>{single ? "Ready to tailor with " : "Ready to compare "}{runProviders.map((p) => PROVIDERS[p].label).join(" vs ")}</strong>
          <p>{single ? "One assistant will rewrite your CV for the role." : "Both assistants run in parallel on the same job — then an LLM judge can pick the best."}</p>
          <button className="flow-btn primary lg" onClick={runAll}>{single ? "Refine my CV" : "Run comparison"}</button>
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
          <Column key={p} provider={p} state={cols[p]} before={before} onApply={() => apply(p)} />
        ))}
      </div>

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

function JudgeBlock() {
  const cols = useRefineStore((s) => s.cols);
  const runProviders = useRefineStore((s) => s.runProviders);
  const judgeProvider = useRefineStore((s) => s.judgeProvider);
  const setJudgeProvider = useRefineStore((s) => s.setJudgeProvider);
  const judgePhase = useRefineStore((s) => s.judgePhase);
  const verdict = useRefineStore((s) => s.verdict);
  const judgeErr = useRefineStore((s) => s.judgeErr);
  const runJudge = useRefineStore((s) => s.runJudge);
  const resetRun = useRefineStore((s) => s.resetRun);
  const baseMatch = useRefineStore((s) => s.baseMatch);
  const keys = useSettingsStore((s) => s.keys);
  const applyRefinedCV = useCVStore((s) => s.applyRefinedCV);
  const setView = useViewStore((s) => s.setView);

  const done = runProviders.filter((p) => cols[p].phase === "done" && cols[p].result);
  if (done.length < 2) return null;

  const applyWinner = () => {
    const w = verdict?.winner as ProviderId | undefined;
    if (!w || !cols[w]?.result) return;
    applyRefinedCV(cols[w].result!.cv);
    setView("edit");
  };

  return (
    <div className="cmp-judge">
      {judgePhase === "idle" && (
        <div className="cmp-judge-bar">
          <span className="cmp-judge-label">Let an LLM judge pick the best</span>
          <div className="cmp-judge-controls">
            <select className="ed-input cmp-judge-sel" value={judgeProvider} onChange={(e) => setJudgeProvider(e.target.value as ProviderId)}>
              {runProviders.filter((p) => keys[p]?.trim()).map((p) => (
                <option key={p} value={p}>Judge: {PROVIDERS[p].label}</option>
              ))}
            </select>
            <button className="flow-btn primary" onClick={() => void runJudge()}>Judge results</button>
          </div>
        </div>
      )}
      {judgePhase === "running" && <div className="cmp-loading"><span className="cmp-spinner" /> {PROVIDERS[judgeProvider].label} is judging…</div>}
      {judgePhase === "error" && judgeErr && (
        <div className="imp-error">
          <strong>{judgeErr.title}{judgeErr.status ? ` (HTTP ${judgeErr.status})` : ""}</strong>
          <pre>{judgeErr.body}</pre>
          <div className="imp-actions"><button className="flow-btn ghost" onClick={resetRun}>Back</button></div>
        </div>
      )}
      {judgePhase === "done" && verdict && (
        <motion.div className="cmp-verdict" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="cmp-verdict-head">
            <span className="cmp-trophy" aria-hidden>🏆</span>
            <div>
              <strong>Winner: {PROVIDERS[verdict.winner as ProviderId]?.label ?? verdict.winner}</strong>
              <span className="cmp-judged-by">judged by {PROVIDERS[judgeProvider].label}</span>
            </div>
          </div>
          {verdict.reasoning && <p className="cmp-reasoning">{verdict.reasoning}</p>}
          {(() => {
            const w = verdict.winner as ProviderId;
            const wm = cols[w]?.match;
            if (!wm || !baseMatch) return null;
            const d = wm.score - baseMatch.score;
            const tone = d > 0 ? "up" : d < 0 ? "down" : "flat";
            return (
              <div className={`cmp-verdict-match ${tone}`}>
                <span className="cvm-icon" aria-hidden>{d > 0 ? "▲" : d < 0 ? "▼" : "="}</span>
                <span className="cvm-text">
                  Winner {d > 0 ? "improves" : d < 0 ? "lowers" : "keeps"} JD match{" "}
                  <b>{baseMatch.score}%</b> → <b>{wm.score}%</b>
                  <span className="cvm-delta"> ({d > 0 ? "+" : ""}{d} pts)</span>
                </span>
              </div>
            );
          })()}
          <div className="cmp-scorecards">
            {verdict.scores.map((sc) => (
              <div key={sc.id} className={`cmp-scorecard ${sc.id === verdict.winner ? "win" : ""}`}>
                <div className="cmp-scorecard-head">
                  <strong>{PROVIDERS[sc.id as ProviderId]?.label ?? sc.id}</strong>
                  <span className="cmp-overall">{sc.overall}</span>
                </div>
                <ScoreBar label="Relevance" v={sc.relevance} />
                <ScoreBar label="Impact" v={sc.impact} />
                <ScoreBar label="Coverage" v={sc.coverage} />
                <ScoreBar label="Conciseness" v={sc.conciseness} />
                {sc.rationale && <p className="cmp-rationale">{sc.rationale}</p>}
              </div>
            ))}
          </div>
          <div className="imp-actions">
            <button className="flow-btn primary" onClick={applyWinner}>Apply winner</button>
            <button className="flow-btn ghost" onClick={resetRun}>Re-judge</button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Column({ provider, state, before, onApply }: { provider: ProviderId; state: ColState; before: ReturnType<typeof countFacts>; onApply: () => void }) {
  const setView = useViewStore((s) => s.setView);
  const ideal = useRefineStore((s) => s.ideal);
  const baseMatch = useRefineStore((s) => s.baseMatch);
  const meta = PROVIDERS[provider];
  const after = state.result ? countFacts(state.result.cv) : null;
  const gap = ideal && state.result ? gapAnalysis(state.result.cv, ideal) : null;
  return (
    <motion.div layout className="cmp-col">
      <div className="cmp-col-head">
        <strong>{meta.label}</strong>
        <span className={`cmp-status ${state.phase}`}>
          {state.phase === "running" && "running…"}
          {state.phase === "done" && "done"}
          {state.phase === "error" && "error"}
          {state.phase === "nokey" && "no key"}
        </span>
      </div>
      {state.phase === "running" && <div className="cmp-loading"><span className="cmp-spinner" /> Contacting {meta.label}…</div>}
      {state.phase === "nokey" && (
        <div className="cmp-empty">No API key for {meta.label}. <button className="ai-link" onClick={() => setView("connect")}>Connect</button></div>
      )}
      {state.phase === "error" && state.error && (
        <div className="imp-error"><strong>{state.error.title}{state.error.status ? ` (HTTP ${state.error.status})` : ""}</strong><pre>{state.error.body}</pre></div>
      )}
      {state.phase === "done" && state.result && after && (
        <>
          <div className="ai-delta cmp-delta">
            <DeltaRow label="Experience" a={before.experience} b={after.experience} />
            <DeltaRow label="Education" a={before.education} b={after.education} />
            <DeltaRow label="Projects" a={before.projects} b={after.projects} />
            <DeltaRow label="Certs" a={before.certifications} b={after.certifications} />
            <DeltaRow label="Skills" a={before.skills} b={after.skills} />
          </div>
          {state.match && <MatchMeter match={state.match} base={baseMatch} />}
          {gap && <IdealGap gap={gap} />}
          {state.result.cv.basics.summary && (
            <div className="ai-summary cmp-summary"><span className="ed-label">Tailored summary</span><p>{state.result.cv.basics.summary}</p></div>
          )}
          {state.result.warnings.length > 0 ? (
            <div className="ai-flags cmp-flags">
              <strong>{state.result.warnings.length} guardrail note{state.result.warnings.length > 1 ? "s" : ""}</strong>
              <ul>{state.result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          ) : (
            <div className="ai-clean cmp-clean">✓ Fully grounded in your CV.</div>
          )}
          <div className="imp-actions cmp-actions"><button className="flow-btn primary" onClick={onApply}>Apply this</button></div>
        </>
      )}
    </motion.div>
  );
}

function IdealGap({ gap }: { gap: GapAnalysis }) {
  const tone = gap.coverage >= 75 ? "hi" : gap.coverage >= 45 ? "mid" : "lo";
  const miss = gap.missingSkills.slice(0, 8);
  const setSkillSuggestions = useCVStore((s) => s.setSkillSuggestions);
  const addSuggestedSection = useCVStore((s) => s.addSuggestedSection);
  const setView = useViewStore((s) => s.setView);
  const baseCV = useRefineStore((s) => s.baseCV);
  const ideal = useRefineStore((s) => s.ideal);
  const baseGap = baseCV && ideal ? gapAnalysis(baseCV, ideal) : null;
  const delta = baseGap ? gap.coverage - baseGap.coverage : null;
  const deltaTone = delta == null ? "" : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const sendToEditor = () => {
    setSkillSuggestions(gap.missingSkills);
    setView("edit");
  };
  const addSection = (k: SectionKey) => {
    addSuggestedSection(k);
    setView("edit");
  };
  return (
    <div className={`jdm idg ${tone}`}>
      <div className="jdm-head">
        <span className="ed-label">vs ideal</span>
        <span className="jdm-head-right">
          {delta != null && (
            <span className={`jdm-delta ${deltaTone}`} title={`Original CV covered ${baseGap!.coverage}% of the ideal`}>
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "="} {delta > 0 ? "+" : ""}{delta} pts
            </span>
          )}
          <span className="jdm-score">{gap.coverage}%</span>
        </span>
      </div>
      <div className="jdm-bar">
        {baseGap && (
          <span className="jdm-base" style={{ width: `${baseGap.coverage}%` }} aria-hidden />
        )}
        <motion.span
          className="jdm-fill"
          initial={{ width: 0 }}
          animate={{ width: `${gap.coverage}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <div className="jdm-sub">
        {gap.matchedSkills.length}/{gap.matchedSkills.length + gap.missingSkills.length} of the ideal&apos;s skills covered
        {delta != null && delta > 0 && <span className="jdm-sub-note"> · up from {baseGap!.coverage}%</span>}
      </div>
      {miss.length > 0 && (
        <div className="jdm-missing">
          <span className="jdm-missing-label">Ideal has, you don&apos;t</span>
          <div className="jdm-chips">
            {miss.map((k) => <span key={k}>{k}</span>)}
            {gap.missingSkills.length > miss.length && (
              <span className="jdm-more">+{gap.missingSkills.length - miss.length}</span>
            )}
          </div>
        </div>
      )}
      {gap.missingSections.length > 0 && (
        <div className="jdm-missing">
          <span className="jdm-missing-label">Sections the ideal has</span>
          <div className="jdm-chips">
            {gap.missingSections.map((k) => (
              <button key={k} className="jdm-sec-add" onClick={() => addSection(k as SectionKey)}>
                ＋ {SECTION_LABELS[k as SectionKey]}
              </button>
            ))}
          </div>
        </div>
      )}
      {gap.missingSkills.length > 0 && (
        <button className="idg-send" onClick={sendToEditor}>
          Add missing skills in editor →
        </button>
      )}
    </div>
  );
}

function MatchMeter({ match, base }: { match: JDMatch; base: JDMatch | null }) {
  const tone = match.score >= 75 ? "hi" : match.score >= 45 ? "mid" : "lo";
  const shownMissing = match.missing.slice(0, 8);
  const delta = base ? match.score - base.score : null;
  const deltaTone = delta == null ? "" : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return (
    <div className={`jdm ${tone}`}>
      <div className="jdm-head">
        <span className="ed-label">JD match</span>
        <span className="jdm-head-right">
          {delta != null && (
            <span className={`jdm-delta ${deltaTone}`} title={`Original CV matched ${base!.score}%`}>
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "="} {delta > 0 ? "+" : ""}{delta} pts
            </span>
          )}
          <span className="jdm-score">{match.score}%</span>
        </span>
      </div>
      <div className="jdm-bar">
        {base && (
          <span className="jdm-base" style={{ width: `${base.score}%` }} aria-hidden />
        )}
        <motion.span
          className="jdm-fill"
          initial={{ width: 0 }}
          animate={{ width: `${match.score}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <div className="jdm-sub">
        {match.matched.length}/{match.matched.length + match.missing.length} keywords covered
        {delta != null && delta > 0 && <span className="jdm-sub-note"> · up from {base!.score}%</span>}
      </div>
      {shownMissing.length > 0 && (
        <div className="jdm-missing">
          <span className="jdm-missing-label">Still missing</span>
          <div className="jdm-chips">
            {shownMissing.map((k) => <span key={k}>{k}</span>)}
            {match.missing.length > shownMissing.length && (
              <span className="jdm-more">+{match.missing.length - shownMissing.length}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DeltaRow({ label, a, b }: { label: string; a: number; b: number }) {
  const diff = b - a;
  return (
    <div className="ai-delta-row">
      <span className="ai-delta-label">{label}</span>
      <span className="ai-delta-nums">
        {a} <span className="ai-arrow">→</span> {b}
        {diff !== 0 && <span className={`ai-diff ${diff > 0 ? "up" : "down"}`}>{diff > 0 ? `+${diff}` : diff}</span>}
      </span>
    </div>
  );
}

function ScoreBar({ label, v }: { label: string; v: number }) {
  return (
    <div className="cmp-scorebar">
      <span className="cmp-scorebar-label">{label}</span>
      <span className="cmp-scorebar-track">
        <motion.span className="cmp-scorebar-fill" initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
      </span>
      <span className="cmp-scorebar-val">{v}</span>
    </div>
  );
}
