"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { useCVStore } from "@/lib/store/cvStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { usePlanStore } from "@/lib/store/planStore";
import { allowCoach, nextPlan } from "@/lib/plan/plan";
import { useViewStore } from "@/lib/store/viewStore";
import { diffCv } from "@/lib/ai/cvDiff";
import { applyOffered, rebaseProposal } from "@/lib/tailor/proposal";
import { useProposalStore } from "@/lib/store/proposalStore";
import { ChangeList } from "@/components/ai/refine/ChangeList";
import { isBetterDraft } from "@/lib/ai/coachLoop";
import { MAX_CRITIC_ROUNDS, shouldContinue, type Critique, type ElicitationQuestion, type GapReport, type IdealProfile } from "@/lib/ai/agents";
import type { CVData } from "@/lib/cv/schema";
import type { GroundingScore } from "@/lib/ai/guardrails";
import type { JDMatch } from "@/lib/ai/jdmatch";

interface Draft {
  cv: CVData;
  warnings: string[];
  grounding: GroundingScore;
  ats: { before: JDMatch; after: JDMatch };
}

interface Analysis {
  runToken: string;
  startedAt: number;
  profile: IdealProfile;
  report: GapReport;
  questions: ElicitationQuestion[];
}

type Phase = "input" | "analyzing" | "questions" | "rewriting" | "review";

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/ai/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: { ok?: boolean; error?: string } & Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    throw new Error("The coach returned an unreadable response. Please try again.");
  }
  if (!data.ok) throw new Error(data.error || "The coach couldn't finish. Please try again.");
  return data as unknown as T;
}

const STORAGE_KEY = "orire-coach-run";
// Matches the server's run-token lifetime; a saved run older than this can no longer continue.
const nowMs = () => Date.now();
const SAVED_RUN_TTL_MS = 30 * 60_000;

interface SavedRun {
  phase: "questions" | "review";
  baseCV: CVData;
  analysis: Analysis;
  answers: Record<string, string>;
  draft: Draft | null;
  rounds: number;
}

/** Restore an in-progress run after a refresh (never a half-finished request). */
function loadSavedRun(): SavedRun | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedRun;
    if (!saved.baseCV || !saved.analysis || nowMs() - saved.analysis.startedAt > SAVED_RUN_TTL_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return saved;
  } catch {
    return null;
  }
}

const quality = (d: Draft) => ({ warnings: d.warnings.length, atsScore: d.ats.after.score });

/**
 * CV coach: model the ideal candidate, find the gaps, ask the candidate a few
 * pointed questions about work the CV under-reports, then rewrite using only
 * the CV and their answers, with a recruiter/ATS critic loop. Nothing touches
 * the CV until the user accepts individual changes.
 */
export function CoachView() {
  const liveCV = useCVStore((s) => s.cv);
  const applyRefinedCV = useCVStore((s) => s.applyRefinedCV);
  const jd = useTargetStore((s) => s.jd);
  const setJd = useTargetStore((s) => s.setJd);
  const setView = useViewStore((s) => s.setView);
  const plan = usePlanStore((s) => s.plan);
  const allowed = allowCoach(plan);

  const [saved] = useState(loadSavedRun);
  const restoredReview = saved?.phase === "review" && saved.draft ? saved.draft : null;
  const [phase, setPhase] = useState<Phase>(saved ? (restoredReview ? "review" : "questions") : "input");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [baseCV, setBaseCV] = useState<CVData | null>(saved?.baseCV ?? null);
  const [analysis, setAnalysis] = useState<Analysis | null>(saved?.analysis ?? null);
  const [answers, setAnswers] = useState<Record<string, string>>(saved?.answers ?? {});
  const [draft, setDraft] = useState<Draft | null>(restoredReview);
  const [critique, setCritique] = useState<Critique | null>(null);
  const [rounds, setRounds] = useState(saved?.rounds ?? 0);
  const [rejected, setRejected] = useState<Set<string>>(
    () => new Set(saved && restoredReview ? diffCv(saved.baseCV, restoredReview.cv).map((c) => c.id) : []),
  );

  // Ignore results from a run the user has since restarted or left.
  const runId = useRef(0);
  useEffect(() => () => { runId.current += 1; }, []);

  useEffect(() => {
    try {
      if ((phase === "questions" || phase === "review") && baseCV && analysis) {
        const run: SavedRun = { phase, baseCV, analysis, answers, draft, rounds };
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(run));
      } else if (phase === "input") {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* storage full or unavailable: persistence is best-effort */
    }
  }, [phase, baseCV, analysis, answers, draft, rounds]);

  const reset = () => {
    runId.current += 1;
    setPhase("input");
    setError(null);
    setAnalysis(null);
    setAnswers({});
    setDraft(null);
    setCritique(null);
    setRounds(0);
  };

  const analyze = async () => {
    const id = ++runId.current;
    const snapshot = useCVStore.getState().cv;
    setError(null);
    setBaseCV(snapshot);
    setPhase("analyzing");
    try {
      const r = await post<Analysis>({ action: "analyze", cv: snapshot, jobDescription: jd });
      if (id !== runId.current) return;
      setAnalysis({ runToken: r.runToken, startedAt: nowMs(), profile: r.profile, report: r.report, questions: r.questions });
      setAnswers({});
      if (r.questions.length > 0) setPhase("questions");
      else await rewrite(id, snapshot, { runToken: r.runToken, startedAt: nowMs(), profile: r.profile, report: r.report, questions: [] }, {});
    } catch (e) {
      if (id !== runId.current) return;
      setError((e as Error).message);
      setPhase("input");
    }
  };

  const rewrite = async (id: number, cv: CVData, a: Analysis, ans: Record<string, string>) => {
    setPhase("rewriting");
    setError(null);
    const answerList = a.questions
      .filter((q) => ans[q.id]?.trim())
      .map((q) => ({ questionId: q.id, question: q.prompt, answer: ans[q.id].trim() }));
    const base = { cv, jobDescription: jd, runToken: a.runToken, profile: a.profile, report: a.report, answers: answerList };
    try {
      setStatus("Rewriting your CV from your facts…");
      let best = await post<Draft>({ action: "rewrite", ...base });
      let last: Critique | null = null;
      let done = 0;
      for (let round = 1; round <= MAX_CRITIC_ROUNDS; round++) {
        if (id !== runId.current) return;
        setStatus("Reviewing as a recruiter and an ATS…");
        const rev = await post<{ critique: Critique }>({ action: "critique", ...base, draft: best.cv });
        last = rev.critique;
        if (!shouldContinue(last, round - 1)) break;
        setStatus(`Refining from the review (round ${round})…`);
        const next = await post<Draft>({ action: "rewrite", ...base, draft: best.cv, critique: last, round });
        if (!isBetterDraft(quality(best), quality(next))) break;
        best = next;
        done = round;
        last = null; // the critique described the previous draft
      }
      if (id !== runId.current) return;
      setDraft(best);
      setCritique(last);
      setRounds(done);
      setRejected(new Set(diffCv(cv, best.cv).map((c) => c.id)));
      setPhase("review");
    } catch (e) {
      if (id !== runId.current) return;
      setError((e as Error).message);
      setPhase(a.questions.length > 0 ? "questions" : "input");
    }
  };

  const registerProposal = useProposalStore((s) => s.register);
  const discardProposal = useProposalStore((s) => s.discard);
  const recordApplied = useProposalStore((s) => s.recordApplied);
  useEffect(() => {
    if (phase === "review" && baseCV && draft) registerProposal("coach", baseCV, draft.cv);
    else discardProposal("coach");
  }, [phase, baseCV, draft, registerProposal, discardProposal]);

  // Re-based onto the live CV, so the review survives edits made meanwhile.
  const rebased = useMemo(
    () => (baseCV && draft ? rebaseProposal(baseCV, draft.cv, liveCV) : { stale: false, changes: [], skipped: [] }),
    [baseCV, draft, liveCV],
  );
  const changes = rebased.changes;
  const accepted = changes.filter((c) => !rejected.has(c.id)).length;

  const apply = () => {
    if (!baseCV || !draft || accepted === 0) return;
    // Re-read at click time so an edit made since render is kept.
    const live = useCVStore.getState().cv;
    const fresh = rebaseProposal(baseCV, draft.cv, live);
    const next = applyOffered(live, draft.cv, fresh.changes, rejected);
    applyRefinedCV(next);
    recordApplied("coach", live, next);
    setView("edit");
  };

  const answeredCount = Object.values(answers).filter((v) => v.trim()).length;

  return (
    <div className="ws-view coach-flow">
      <div className="ws-head">
        <div>
          <h2>Coach me to the role</h2>
          <p>We find what this job wants, ask about work your CV under-reports, then rewrite using only your CV and your answers.</p>
        </div>
        {phase !== "input" && <button className="ws-reset" onClick={reset}>Start over</button>}
      </div>

      {!allowed && (
        <div className="cl-gate">
          <strong>The CV coach is a {nextPlan("free")?.label ?? "Pro"} feature.</strong>
          <p>Upgrade to get tailored questions, a fact-grounded rewrite and a recruiter/ATS review.</p>
          <button className="flow-btn primary" onClick={() => setView("connect")}>See plans</button>
        </div>
      )}

      {error && <div className="rev-ground review" role="alert"><p>{error}</p></div>}

      {allowed && phase === "input" && (
        <div className="step-body">
          <div className="ai-field">
            <label className="ed-label" htmlFor="coach-jd">Job description</label>
            <textarea
              id="coach-jd"
              className="ed-input ai-jd"
              value={jd}
              placeholder="Paste the full job description here…"
              onChange={(e) => setJd(e.target.value)}
              rows={12}
            />
          </div>
          <div className="step-nav">
            <button className="flow-btn primary" onClick={analyze} disabled={!jd.trim()}>Analyse my CV</button>
          </div>
        </div>
      )}

      {(phase === "analyzing" || phase === "rewriting") && (
        <div className="coach-busy" role="status" aria-live="polite" aria-busy="true">
          <p>{phase === "analyzing" ? "Modelling the ideal candidate and comparing your CV…" : status}</p>
        </div>
      )}

      {phase === "questions" && analysis && baseCV && (
        <div className="step-body">
          <GapSummary report={analysis.report} />
          <p className="step-hint">
            Answer what you can — real numbers and outcomes help most. Only what you type here is added. We can’t verify your answers, so include only what’s true; skip anything you don’t remember.
          </p>
          <div className="coach-questions">
            {analysis.questions.map((q) => (
              <div key={q.id} className="ai-field">
                <label className="ed-label" htmlFor={`coach-${q.id}`}>{q.prompt}</label>
                {q.targets && <span className="coach-target" id={`coach-${q.id}-t`}>{q.targets}</span>}
                <textarea
                  id={`coach-${q.id}`}
                  aria-describedby={q.targets ? `coach-${q.id}-t coach-${q.id}-n` : `coach-${q.id}-n`}
                  className="ed-input"
                  rows={3}
                  maxLength={600}
                  value={answers[q.id] ?? ""}
                  placeholder={q.kind === "metric" ? "e.g. a number, and what it was compared with" : "Your answer (optional)"}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                />
                <span className="coach-count" id={`coach-${q.id}-n`}>{(answers[q.id] ?? "").length}/600</span>
              </div>
            ))}
          </div>
          <div className="step-nav">
            <button className="flow-btn ghost" onClick={reset}>Back</button>
            <button className="flow-btn primary" onClick={() => rewrite(++runId.current, baseCV, analysis, answers)}>
              {answeredCount > 0 ? `Rewrite with ${answeredCount} answer${answeredCount > 1 ? "s" : ""}` : "Skip questions and rewrite"}
            </button>
          </div>
        </div>
      )}

      {phase === "review" && draft && analysis && (
        <div className="rev">
          <div className="coach-ats">
            <span>Keyword coverage</span>
            <strong>{draft.ats.before.score}% → {draft.ats.after.score}%</strong>
            {rounds > 0 && <span>· refined {rounds} time{rounds > 1 ? "s" : ""} after review</span>}
          </div>

          <div className={`rev-ground ${draft.grounding.label}`}>
            {draft.warnings.length === 0 ? (
              <p>✓ No issues flagged by automated checks. <strong>This does not prove the wording is accurate.</strong> Check every claim against your own experience.</p>
            ) : (
              <>
                <p><strong>Review required:</strong> {draft.warnings.length} possible unsupported detail{draft.warnings.length > 1 ? "s" : ""}.</p>
                <ul>{draft.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </>
            )}
          </div>

          {rebased.stale && (
            <div className="rev-ground review" role="status">
              <strong>Your CV changed since this was made.</strong>{" "}
              {rebased.skipped.length > 0
                ? `${rebased.skipped.length} change${rebased.skipped.length > 1 ? "s were" : " was"} skipped because you edited the same part${rebased.skipped.length > 1 ? "s" : ""} (${rebased.skipped.map((c) => c.label).join(", ")}). `
                : ""}
              The rest still apply on top of your edits.
            </div>
          )}

          {critique && (critique.recruiter.issues.length > 0 || critique.ats.parseRisks.length > 0) && (
            <div className="coach-remaining">
              <strong>Still worth a look</strong>
              <ul>
                {critique.recruiter.issues.map((i, n) => <li key={n}>{i.problem} — {i.fix}</li>)}
                {critique.ats.parseRisks.map((r, n) => <li key={`p${n}`}>{r}</li>)}
              </ul>
            </div>
          )}

          <GapSummary report={analysis.report} genuineOnly />

          {changes.length === 0 ? (
            <div className="rev-none"><p>No wording changes were proposed for your CV.</p></div>
          ) : (
            <ChangeList changes={changes} rejected={rejected} setRejected={setRejected} />
          )}

          <div className="rev-foot">
            <button className="flow-btn ghost" onClick={reset}>Discard</button>
            <button className="flow-btn primary lg" onClick={apply} disabled={accepted === 0}>
              {accepted === 0 ? "Select changes to apply" : `Apply ${accepted} change${accepted > 1 ? "s" : ""} to my CV`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GapSummary({ report, genuineOnly }: { report: GapReport; genuineOnly?: boolean }) {
  if (genuineOnly && report.genuineGap.length === 0) return null;
  return (
    <div className="coach-gaps">
      {!genuineOnly && report.matched.length > 0 && (
        <p><strong>Already strong:</strong> {report.matched.join(" · ")}</p>
      )}
      {!genuineOnly && report.understated.length > 0 && (
        <p><strong>You likely have, but the CV undersells:</strong> {report.understated.map((g) => g.area).join(" · ")}</p>
      )}
      {report.genuineGap.length > 0 && (
        <div>
          <p><strong>Not shown on your CV (we won’t fake these):</strong></p>
          <ul>{report.genuineGap.map((g, i) => <li key={i}>{g.area}{g.advice ? ` — ${g.advice}` : ""}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
