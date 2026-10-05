"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { useRefineStore } from "@/lib/store/refineStore";
import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";

export function JudgeBlock() {
  const cols = useRefineStore((s) => s.cols);
  const runProviders = useRefineStore((s) => s.runProviders);
  const judgeProvider = useRefineStore((s) => s.judgeProvider);
  const setJudgeProvider = useRefineStore((s) => s.setJudgeProvider);
  const judgePhase = useRefineStore((s) => s.judgePhase);
  const verdict = useRefineStore((s) => s.verdict);
  const judgeErr = useRefineStore((s) => s.judgeErr);
  const judgeFromCache = useRefineStore((s) => s.judgeFromCache);
  const runJudge = useRefineStore((s) => s.runJudge);
  const resetJudge = useRefineStore((s) => s.resetJudge);
  const baseMatch = useRefineStore((s) => s.baseMatch);
  const applyRefinedCV = useCVStore((s) => s.applyRefinedCV);
  const setView = useViewStore((s) => s.setView);

  const done = runProviders.filter((p) => cols[p].phase === "done" && cols[p].result);

  const eligible = runProviders;
  // Keep the stored judge provider in sync with what the dropdown can show:
  // the default ("openai") may not be connected, which would make the first
  // "Judge results" click fail even though a valid provider appears selected.
  useEffect(() => {
    if (eligible.length > 0 && !eligible.includes(judgeProvider)) {
      setJudgeProvider(eligible[0]);
    }
  }, [eligible, judgeProvider, setJudgeProvider]);

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
              {eligible.map((p) => (
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
          <div className="imp-actions"><button className="flow-btn ghost" onClick={resetJudge}>Back to results</button></div>
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
          {judgeFromCache && (
            <p className="cmp-cache-note" title="Identical inputs return the same verdict. Use “Run fresh” to re-sample the model.">
              ⦿ Deterministic result — reused from identical inputs.
            </p>
          )}
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
            <button className="flow-btn ghost" onClick={resetJudge}>Re-judge</button>
            <button className="flow-btn ghost" onClick={() => void runJudge(true)} title="Re-sample the model, ignoring the deterministic cache">Run fresh</button>
          </div>
        </motion.div>
      )}
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
