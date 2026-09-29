"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";
import type { RefineResponse } from "@/lib/ai/types";
import { parseModelJSON, factGround, RefineParseError, type GroundingResult } from "@/lib/ai/guardrails";
import { parseVerdict, type JudgeVerdict } from "@/lib/ai/judge";
import type { CVData } from "@/lib/cv/schema";

type ColPhase = "idle" | "nokey" | "running" | "error" | "done";
interface ColState {
  phase: ColPhase;
  result?: GroundingResult;
  error?: { title: string; body: string; status?: number };
}

const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

function countFacts(cv: CVData) {
  return {
    experience: cv.experience.length,
    education: cv.education.length,
    projects: cv.projects.length,
    certifications: cv.certifications.length,
    skills: cv.skills.reduce((a, g) => a + g.items.length, 0),
  };
}

export function ComparePanel({ onClose, onOpenSettings }: { onClose: () => void; onOpenSettings: () => void }) {
  const cv = useCVStore((s) => s.cv);
  const applyRefinedCV = useCVStore((s) => s.applyRefinedCV);
  const activeProvider = useSettingsStore((s) => s.provider);
  const keys = useSettingsStore((s) => s.keys);
  const models = useSettingsStore((s) => s.models);

  const [jd, setJd] = useState("");
  const [started, setStarted] = useState(false);
  const [cols, setCols] = useState<Record<ProviderId, ColState>>({
    openai: { phase: "idle" },
    anthropic: { phase: "idle" },
  });

  // LLM-as-judge state (req 7).
  const [judgeProvider, setJudgeProvider] = useState<ProviderId>(activeProvider);
  const [judgePhase, setJudgePhase] = useState<"idle" | "running" | "error" | "done">("idle");
  const [verdict, setVerdict] = useState<JudgeVerdict | null>(null);
  const [judgeErr, setJudgeErr] = useState<{ title: string; body: string; status?: number } | null>(null);

  const anyRunning = PROVIDER_IDS.some((p) => cols[p].phase === "running");
  const configuredCount = PROVIDER_IDS.filter((p) => keys[p]?.trim()).length;
  const doneProviders = PROVIDER_IDS.filter((p) => cols[p].phase === "done" && cols[p].result);
  const canJudge = doneProviders.length >= 2;

  async function runJudge() {
    if (!canJudge) return;
    if (!keys[judgeProvider]?.trim()) {
      setJudgeErr({ title: "No API key", body: `Add your ${PROVIDERS[judgeProvider].label} key in Settings first.` });
      setJudgePhase("error");
      return;
    }
    setJudgePhase("running");
    setJudgeErr(null);
    setVerdict(null);
    const candidates = doneProviders.map((p) => ({
      id: p,
      label: PROVIDERS[p].label,
      cv: cols[p].result!.cv,
    }));
    try {
      const res = await fetch("/api/ai/judge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: judgeProvider,
          apiKey: keys[judgeProvider],
          model: models[judgeProvider],
          jobDescription: jd,
          candidates,
        }),
      });
      const data = (await res.json()) as RefineResponse;
      if (!data.ok || !data.raw) {
        setJudgeErr({
          title: `${PROVIDERS[judgeProvider].label} error`,
          body: data.error?.message ?? "Unknown error.",
          status: data.error?.status,
        });
        setJudgePhase("error");
        return;
      }
      setVerdict(parseVerdict(data.raw, candidates.map((c) => c.id)));
      setJudgePhase("done");
    } catch (e) {
      const msg = e instanceof RefineParseError ? e.message : e instanceof Error ? e.message : String(e);
      setJudgeErr({ title: "Could not process the verdict", body: msg });
      setJudgePhase("error");
    }
  }

  function resetAll() {
    setStarted(false);
    setCols({ openai: { phase: "idle" }, anthropic: { phase: "idle" } });
    setJudgePhase("idle");
    setVerdict(null);
    setJudgeErr(null);
  }

  async function runOne(provider: ProviderId) {
    if (!keys[provider]?.trim()) {
      setCols((c) => ({ ...c, [provider]: { phase: "nokey" } }));
      return;
    }
    setCols((c) => ({ ...c, [provider]: { phase: "running" } }));
    try {
      const res = await fetch("/api/ai/refine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: keys[provider],
          model: models[provider],
          jobDescription: jd,
          cv,
        }),
      });
      const data = (await res.json()) as RefineResponse;
      if (!data.ok || !data.raw) {
        setCols((c) => ({
          ...c,
          [provider]: {
            phase: "error",
            error: {
              title: `${PROVIDERS[provider].label} error`,
              body: data.error?.message ?? "Unknown error.",
              status: data.error?.status,
            },
          },
        }));
        return;
      }
      const grounded = factGround(cv, parseModelJSON(data.raw));
      setCols((c) => ({ ...c, [provider]: { phase: "done", result: grounded } }));
    } catch (e) {
      const msg = e instanceof RefineParseError ? e.message : e instanceof Error ? e.message : String(e);
      setCols((c) => ({
        ...c,
        [provider]: { phase: "error", error: { title: "Could not process the response", body: msg } },
      }));
    }
  }

  function run() {
    if (!jd.trim()) return;
    setStarted(true);
    // Fire both providers concurrently (req 8) — each column updates as it resolves.
    PROVIDER_IDS.forEach((p) => void runOne(p));
  }

  function apply(provider: ProviderId) {
    const r = cols[provider].result;
    if (!r) return;
    applyRefinedCV(r.cv);
    onClose();
  }

  const before = countFacts(cv);

  return (
    <motion.div
      className="imp-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="imp-modal ai-modal cmp-modal"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="imp-head">
          <div>
            <h2>Compare assistants</h2>
            <p>Run both providers on the same job description, in parallel, and apply whichever you prefer.</p>
          </div>
          <button className="imp-x" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="ai-runbar">
          <span className="ai-pill">
            {configuredCount}/{PROVIDER_IDS.length} providers configured
          </span>
          <button className="ai-link" onClick={onOpenSettings}>Settings</button>
        </div>

        {!started && (
          <>
            <div className="ai-field">
              <span className="ed-label">Job description</span>
              <textarea
                className="ed-input ai-jd"
                value={jd}
                placeholder="Paste the full job description here…"
                onChange={(e) => setJd(e.target.value)}
                rows={9}
              />
            </div>
            {configuredCount < 2 && (
              <p className="ai-note">
                Only {configuredCount} provider{configuredCount === 1 ? " is" : "s are"} set up. Add a second
                key in Settings to compare two assistants side by side.
              </p>
            )}
            <div className="imp-actions">
              <button className="imp-btn primary" onClick={run} disabled={!jd.trim() || configuredCount === 0}>
                Run comparison
              </button>
            </div>
          </>
        )}

        {started && (
          <>
            <div className="cmp-grid">
              {PROVIDER_IDS.map((p) => (
                <Column
                  key={p}
                  provider={p}
                  model={models[p]}
                  state={cols[p]}
                  before={before}
                  isWinner={judgePhase === "done" && verdict?.winner === p}
                  score={verdict?.scores.find((s) => s.id === p)?.overall}
                  onApply={() => apply(p)}
                  onOpenSettings={onOpenSettings}
                />
              ))}
            </div>

            {canJudge && (
              <div className="cmp-judge">
                {judgePhase === "idle" && (
                  <div className="cmp-judge-bar">
                    <span className="cmp-judge-label">Let an LLM judge pick the best</span>
                    <div className="cmp-judge-controls">
                      <select
                        className="ed-input cmp-judge-sel"
                        value={judgeProvider}
                        onChange={(e) => setJudgeProvider(e.target.value as ProviderId)}
                      >
                        {PROVIDER_IDS.filter((p) => keys[p]?.trim()).map((p) => (
                          <option key={p} value={p}>Judge: {PROVIDERS[p].label}</option>
                        ))}
                      </select>
                      <button className="imp-btn primary" onClick={runJudge}>Judge results</button>
                    </div>
                  </div>
                )}

                {judgePhase === "running" && (
                  <div className="cmp-loading">
                    <span className="cmp-spinner" /> {PROVIDERS[judgeProvider].label} is judging…
                  </div>
                )}

                {judgePhase === "error" && judgeErr && (
                  <div className="imp-error">
                    <strong>{judgeErr.title}{judgeErr.status ? ` (HTTP ${judgeErr.status})` : ""}</strong>
                    <pre>{judgeErr.body}</pre>
                    <div className="imp-actions">
                      <button className="imp-btn" onClick={() => setJudgePhase("idle")}>Back</button>
                    </div>
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
                      <button className="imp-btn primary" onClick={() => apply(verdict.winner as ProviderId)}>
                        Apply winner
                      </button>
                      <button className="imp-btn" onClick={() => setJudgePhase("idle")}>Re-judge</button>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            <div className="imp-actions">
              <button className="imp-btn" onClick={resetAll} disabled={anyRunning}>
                {anyRunning ? "Running…" : "New comparison"}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function Column({
  provider,
  model,
  state,
  before,
  isWinner,
  score,
  onApply,
  onOpenSettings,
}: {
  provider: ProviderId;
  model: string;
  state: ColState;
  before: ReturnType<typeof countFacts>;
  isWinner?: boolean;
  score?: number;
  onApply: () => void;
  onOpenSettings: () => void;
}) {
  const meta = PROVIDERS[provider];
  const after = state.result ? countFacts(state.result.cv) : null;

  return (
    <motion.div layout className={`cmp-col ${isWinner ? "winner" : ""}`}>
      <div className="cmp-col-head">
        <strong>{meta.label}</strong>
        {isWinner ? (
          <span className="cmp-winbadge">🏆 {typeof score === "number" ? score : "best"}</span>
        ) : (
          <span className={`cmp-status ${state.phase}`}>
            {state.phase === "running" && "running…"}
            {state.phase === "done" && "done"}
            {state.phase === "error" && "error"}
            {state.phase === "nokey" && "no key"}
          </span>
        )}
      </div>
      <span className="cmp-model">{model}</span>

      {state.phase === "running" && (
        <div className="cmp-loading">
          <span className="cmp-spinner" /> Contacting {meta.label}…
        </div>
      )}

      {state.phase === "nokey" && (
        <div className="cmp-empty">
          No API key for {meta.label}.
          <button className="ai-link" onClick={onOpenSettings}>Add key</button>
        </div>
      )}

      {state.phase === "error" && state.error && (
        <div className="imp-error">
          <strong>{state.error.title}{state.error.status ? ` (HTTP ${state.error.status})` : ""}</strong>
          <pre>{state.error.body}</pre>
        </div>
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

          {state.result.cv.basics.summary && (
            <div className="ai-summary cmp-summary">
              <span className="ed-label">Tailored summary</span>
              <p>{state.result.cv.basics.summary}</p>
            </div>
          )}

          <AnimatePresence>
            {state.result.warnings.length > 0 ? (
              <motion.div className="ai-flags cmp-flags" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <strong>{state.result.warnings.length} guardrail note{state.result.warnings.length > 1 ? "s" : ""}</strong>
                <ul>
                  {state.result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </motion.div>
            ) : (
              <motion.div className="ai-clean cmp-clean" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                ✓ Fully grounded in your CV.
              </motion.div>
            )}
          </AnimatePresence>

          <div className="imp-actions cmp-actions">
            <button className="imp-btn primary" onClick={onApply}>Apply this</button>
          </div>
        </>
      )}
    </motion.div>
  );
}

function DeltaRow({ label, a, b }: { label: string; a: number; b: number }) {
  const diff = b - a;
  return (
    <div className="ai-delta-row">
      <span className="ai-delta-label">{label}</span>
      <span className="ai-delta-nums">
        {a} <span className="ai-arrow">→</span> {b}
        {diff !== 0 && (
          <span className={`ai-diff ${diff > 0 ? "up" : "down"}`}>{diff > 0 ? `+${diff}` : diff}</span>
        )}
      </span>
    </div>
  );
}

function ScoreBar({ label, v }: { label: string; v: number }) {
  return (
    <div className="cmp-scorebar">
      <span className="cmp-scorebar-label">{label}</span>
      <span className="cmp-scorebar-track">
        <motion.span
          className="cmp-scorebar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${v}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </span>
      <span className="cmp-scorebar-val">{v}</span>
    </div>
  );
}
