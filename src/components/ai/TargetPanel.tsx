"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { VIEW_META } from "@/lib/store/viewMeta";
import { useTargetStore, isIdealStale } from "@/lib/store/targetStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { usePlanStore } from "@/lib/store/planStore";
import { planQualityLabel } from "@/lib/plan/plan";
import { SimulateProgress } from "@/components/ai/SimulateProgress";
import { getTemplate } from "@/components/templates/registry";
import { gapAnalysis, targetMatch } from "@/lib/ai/simulate";
import { TONE_OPTIONS, useRetone } from "@/lib/ai/useRetone";
import { useSimulateRun } from "@/lib/ai/useSimulateRun";
import { PROVIDERS } from "@/lib/ai/types";
import { NoticeSlot, type SimNotice } from "@/components/ai/simulate/NoticeSlot";
import { VerdictStrip } from "@/components/ai/simulate/VerdictStrip";
import { rankMissingSections, rankMissingSkills } from "@/lib/ai/simulateImpact";
import { printGapReport } from "@/lib/ai/simulateReport";
import { advanceGuidedRun } from "@/components/ai/RunAll";
import { useRunAllStore } from "@/lib/store/runAllStore";
import { isFinished } from "@/lib/tailor/runAll";
import { DiffView } from "./simulate/DiffView";
import { ScaledPaper } from "./simulate/ScaledPaper";
import { GapPanel } from "@/components/ai/simulate/GapPanel";

export function TargetView() {
  const cv = useCVStore((s) => s.cv);
  const activeTemplate = useCVStore((s) => s.activeTemplate);
  const setSkillSuggestions = useCVStore((s) => s.setSkillSuggestions);
  const setView = useViewStore((s) => s.setView);
  const guidedRun = useRunAllStore((s) => s.run !== null && !isFinished(s.run));
  const ideal = useTargetStore((s) => s.ideal);
  const jd = useTargetStore((s) => s.jd);
  const setJd = useTargetStore((s) => s.setJd);
  const label = useTargetStore((s) => s.label);
  const createdAt = useTargetStore((s) => s.createdAt);
  const baseScore = useTargetStore((s) => s.baseScore);
  const clearTarget = useTargetStore((s) => s.discardTarget);
  const jdStale = useTargetStore(isIdealStale);
  const resimPrompt = useTargetStore((s) => s.resimPrompt);
  const dismissResim = useTargetStore((s) => s.dismissResim);
  const history = useTargetStore((s) => s.history);
  const saved = useTargetStore((s) => s.saved);
  const switchTarget = useTargetStore((s) => s.switchTarget);
  const removeSaved = useTargetStore((s) => s.removeSaved);
  const recordScore = useTargetStore((s) => s.recordScore);

  const provider = useSettingsStore((s) => s.provider);
  const plan = usePlanStore((s) => s.plan);

  const retone = useRetone(ideal, jd, "Target");
  const sim = useSimulateRun("Target");
  const [compare, setCompare] = useState<"yours" | "ideal" | "both" | "diff">("both");
  // Building the ideal CV happens inline here, so Target is a single destination.
  const [recompose, setRecompose] = useState(false);

  const meta = PROVIDERS[provider];

  // Keep editor skill chips aligned with the live gap vs the locked ideal.
  useEffect(() => {
    if (!ideal) return;
    setSkillSuggestions(gapAnalysis(cv, ideal).missingSkills, ideal.skills);
  }, [cv, ideal, setSkillSuggestions]);

  // Record the live score (debounced) so the verdict strip can show progress.
  useEffect(() => {
    if (!ideal) return;
    const id = setTimeout(() => recordScore(targetMatch(cv, ideal, jd).score), 800);
    return () => clearTimeout(id);
  }, [cv, ideal, jd, recordScore]);

  const MineTpl = getTemplate(activeTemplate).Component;

  async function generate() {
    if (!(await sim.generate())) return;
    retone.discard();
    setRecompose(false);
  }

  const showGenerator = !ideal || recompose;
  if (showGenerator) {
    const { busyElsewhere, running } = sim;
    return (
      <motion.div
        className="ws-view tgt-view"
        initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="ws-head">
          <div>
            <button type="button" className="ws-back" onClick={() => setView("tailor")}>← Back to Tailor</button>
            <h2>{VIEW_META.target.label}</h2>
            <p>
              {recompose
                ? "Confirm or edit the job description below, then rebuild the ideal CV against your latest CV. Your current target stays until the new one is ready."
                : "Generate an illustrative role-target CV from a job description and compare it with your experience. Scores are Orire guidance, not an employer or ATS assessment."}
            </p>
          </div>
        </div>

        <div className="ai-runbar">
          <span className="ai-pill">{meta.label} · {planQualityLabel(plan)}</span>
          <button className="ai-link" onClick={() => setView("connect")}>AI Settings</button>
        </div>

        {sim.phase === "error" && sim.err ? (
          <>
            <div className="imp-error">
              <strong>{sim.err.title}{sim.err.status ? ` (HTTP ${sim.err.status})` : ""}</strong>
              <pre>{sim.err.body}</pre>
            </div>
            <div className="imp-actions">
              <button className="imp-btn" onClick={sim.backToInput}>Back</button>
            </div>
          </>
        ) : (
          <>
            <label className="ed-label" htmlFor="tgt-jd">Job description</label>
            <textarea
              id="tgt-jd"
              className="ed-input sim-jd"
              placeholder="Paste the full job description…"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              disabled={sim.phase === "running"}
            />
            {running && <SimulateProgress startedAt={sim.startedAt} />}
            <div className="imp-actions">
              <button
                className="imp-btn"
                onClick={() => (recompose ? setRecompose(false) : setView("edit"))}
              >
                {recompose ? "Keep current target" : "Cancel"}
              </button>
              <button className="imp-btn primary" onClick={generate} disabled={running || !jd.trim()}>
                {sim.phase === "running" ? (
                  <><span className="cmp-spinner" /> Building ideal candidate…</>
                ) : busyElsewhere ? (
                  <><span className="cmp-spinner" /> Simulating{sim.startedBy ? ` · from ${sim.startedBy}` : ""}…</>
                ) : (
                  "Generate role-target example"
                )}
              </button>
            </div>
          </>
        )}
      </motion.div>
    );
  }

  const match = targetMatch(cv, ideal, jd);
  const gap = match.gap;
  const rankedSkills = rankMissingSkills(cv, ideal, jd);
  const rankedSections = rankMissingSections(cv, ideal, jd);
  const IdealTpl = getTemplate(activeTemplate).Component;
  const dateLabel = createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";


  const exportReport = () => printGapReport({ label: label || "Target role", match, baseScore, rankedSkills, rankedSections });

  const openResim = () => { setRecompose(true); sim.backToInput(); };
  const notices: SimNotice[] = [];
  if (sim.usageNote) notices.push({ id: "usage", body: sim.usageNote });
  if (resimPrompt) {
    notices.push({
      id: "resim",
      body: <><strong>Your CV changed after a refinement.</strong> Re-simulate to benchmark the new version against the latest job description?</>,
      actions: (
        <>
          <button className="imp-btn" onClick={dismissResim}>Not now</button>
          <button className="imp-btn primary" onClick={() => { dismissResim(); openResim(); }}>Re-simulate with my new CV</button>
        </>
      ),
    });
  } else if (jdStale) {
    notices.push({
      id: "stale",
      body: <><strong>The job description changed</strong> since this target was simulated (it is shared with Rewrite). Re-simulate to benchmark against the current JD.</>,
      actions: <button className="imp-btn primary" onClick={openResim}>Re-simulate with current JD</button>,
    });
  }

  // What the left column shows: the rewritten preview when one exists (and the
  // person isn't peeking at the original), otherwise the live CV.
  const { preview, showBefore, phase, err, detected, activeTone, previewMatch, fidelity } = retone;
  const leftCV = preview && !showBefore ? preview.cv : cv;

  return (
    <motion.div
      className="ws-view tgt-view"
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ws-head">
        <div>
          <button type="button" className="ws-back" onClick={() => setView("tailor")}>← Back to Tailor</button>
          <h2>{VIEW_META.target.label}</h2>
          <p>
            Your latest CV against the ideal for <strong>{label || "this role"}</strong>
            {dateLabel ? ` · locked ${dateLabel}` : ""}.
          </p>
        </div>
        <details className="sim-more">
          <summary className="imp-btn" aria-label="More actions">⋯</summary>
          <div className="sim-more-menu">
            <button className="imp-btn" onClick={openResim}>New simulation</button>
            <button className="imp-btn" onClick={exportReport}>Gap report (PDF)</button>
            <button className="imp-btn danger" onClick={clearTarget}>Clear target</button>
          </div>
        </details>
      </div>

      {saved.length > 0 && (
        <div className="sim-targets" role="tablist" aria-label="Targets">
          {saved.map((t) => (
            <span key={t.id} className="sim-target">
              <button role="tab" aria-selected={false} onClick={() => { retone.discard(); switchTarget(t.id); }}>{t.label}</button>
              <button className="sim-target-x" aria-label={`Remove ${t.label}`} onClick={() => removeSaved(t.id)}>×</button>
            </span>
          ))}
          <span className="sim-target on"><button role="tab" aria-selected>{label || "This role"}</button></span>
          <button className="sim-target new" onClick={openResim}>+ New</button>
        </div>
      )}

      <NoticeSlot notices={notices} />

      <VerdictStrip
        history={history}
        score={match.score}
        baseScore={baseScore}
        matched={gap.matchedSkills.length}
        missing={gap.missingSkills.length}
        actions={
          <>
            {!guidedRun && <button className="imp-btn" onClick={() => setView("refine")}>Rewrite to JD</button>}
            {guidedRun
              ? <button className="imp-btn primary" onClick={() => { if (!advanceGuidedRun()) setView("edit"); }}>Next step</button>
              : <button className="imp-btn primary" onClick={() => setView("edit")}>Edit my CV</button>}
          </>
        }
      />

      <div className="sim-layout">
        <div className="sim-rail">
          <GapPanel
            match={match}
            cv={cv}
            rankedSkills={rankedSkills}
            rankedSections={rankedSections}
            onAddSkill={(s) => useCVStore.getState().acceptSkillSuggestion(s)}
            onAddSection={(k) => useCVStore.getState().addSuggestedSection(k)}
          />
          {detected && (
            <details className="sim-voice">
              <summary>
                <span>Rewrite in target&apos;s tone</span>
                <span className="tone-badge" data-tone={activeTone}>{activeTone}</span>
              </summary>
            <div className="tone-studio">
              <div className="tone-studio-head">
                <span className="tone-badge" data-tone={activeTone}>Target voice · {detected.label}</span>
                <span className="tone-blurb">{detected.blurb}</span>
              </div>
              <div className="tone-toggle" role="group" aria-label="Rewrite voice">
                {TONE_OPTIONS.map((t) => (
                  <button
                    key={t}
                    className={`tone-opt ${activeTone === t ? "on" : ""}`}
                    onClick={() => retone.setToneLabel(t)}
                    disabled={phase === "running"}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="tone-hint">
                Voice only, your employers, dates, numbers, and skills stay exactly as they are. The
                target&apos;s metrics are never borrowed.
              </p>
              <button
                className="imp-btn accent sim-voice-run"
                onClick={retone.run}
                disabled={phase === "running"}
                title={`Rewrite your CV in the target's ${activeTone.toLowerCase()} voice; facts stay yours`}
              >
                {phase === "running" ? (
                  <><span className="cmp-spinner" /> Rewriting…</>
                ) : (
                  <>Rewrite in {activeTone.toLowerCase()} voice</>
                )}
              </button>
            </div>
            </details>
          )}

          <AnimatePresence>
            {phase === "error" && err && (
              <motion.div
                key="tone-err"
                className="imp-error tone-error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <strong>{err.title}{err.status ? ` (HTTP ${err.status})` : ""}</strong>
                <pre>{err.body}</pre>
                <button className="imp-btn" onClick={retone.discard}>Dismiss</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="sim-main">
          <div className="sim-seg sim-view-seg" role="tablist" aria-label="Compare view">
            {(["yours", "ideal", "both", "diff"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={compare === m}
                className={compare === m ? "on" : ""}
                onClick={() => setCompare(m)}
              >
                {m === "yours" ? "Yours" : m === "ideal" ? "Ideal" : m === "both" ? "Side by Side" : "Diff"}
              </button>
            ))}
          </div>

          {compare === "diff" && (
            <DiffView
              ideal={ideal}
              gap={gap}
              onAddSkill={(s) => useCVStore.getState().acceptSkillSuggestion(s)}
              onAddSection={(k) => useCVStore.getState().addSuggestedSection(k)}
              onEdit={() => setView("edit")}
            />
          )}

          <div className={`tgt-split sim-split ${compare}`} hidden={compare === "diff"}>
            {compare !== "ideal" && (
              <div className="tgt-col">
                <div className="tgt-col-head mine">
                  <span className="tgt-col-tag">{preview && !showBefore ? `Rewritten · ${activeTone}` : "Yours"}</span>
                  <span className="tgt-col-sub">{getTemplate(activeTemplate).name}</span>
                </div>
                <div className="tgt-paper-wrap">
                  {preview && !showBefore && <span className="sim-ribbon after">AFTER</span>}
                  <ScaledPaper><MineTpl cv={leftCV} /></ScaledPaper>
                </div>
              </div>
            )}

            {compare !== "yours" && (
              <div className="tgt-col">
                <div className="tgt-col-head ideal">
                  <span className="tgt-col-tag">Simulated reference</span>
                  <span className="tgt-col-sub">Simulated · not your facts</span>
                </div>
                <div className="tgt-paper-wrap">
                  <span className="sim-ribbon">TARGET</span>
                  <ScaledPaper><IdealTpl cv={ideal} /></ScaledPaper>
                </div>
              </div>
            )}
          </div>

          <AnimatePresence>
            {phase === "preview" && preview && previewMatch && fidelity && (
              <motion.div
                key="tone-apply"
                className="tone-applybar sim-applybar"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
              >
                <div className="tone-applybar-stats">
                  <span className="tone-badge" data-tone={activeTone}>Rewritten · {activeTone}</span>
                  {previewMatch.score !== match.score && (
                    <span className={`tgt-stat ${previewMatch.score >= match.score ? "match" : "miss"}`}>
                      {previewMatch.score >= match.score ? "▲" : "▼"} {Math.abs(previewMatch.score - match.score)}% match
                    </span>
                  )}
                  <span className={`tone-fidelity ${fidelity.label}`} title="How faithfully the rewrite stayed grounded in your real facts">
                    {fidelity.score}% grounded
                  </span>
                  {preview.warnings.length > 0 && (
                    <span className="tgt-stat miss">{preview.warnings.length} note{preview.warnings.length > 1 ? "s" : ""}</span>
                  )}
                </div>
                <div className="tone-applybar-actions">
                  <button
                    className="imp-btn"
                    onMouseDown={() => retone.setShowBefore(true)}
                    onMouseUp={() => retone.setShowBefore(false)}
                    onMouseLeave={() => retone.setShowBefore(false)}
                  >
                    {showBefore ? "Showing original" : "Hold to compare"}
                  </button>
                  <button className="imp-btn" onClick={retone.discard}>Discard</button>
                  <button className="imp-btn primary" onClick={retone.apply}>Apply to my CV</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
