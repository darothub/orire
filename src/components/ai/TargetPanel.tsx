"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { VIEW_META } from "@/lib/store/viewMeta";
import { useTargetStore, isIdealStale } from "@/lib/store/targetStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { usePlanStore } from "@/lib/store/planStore";
import { planQualityLabel, remainingNote } from "@/lib/plan/plan";
import { useUsageStore } from "@/lib/store/usageStore";
import { sharedRun, useIsRunning, useRunOrigin, useRunStore } from "@/lib/store/runStore";
import { SimulateProgress } from "@/components/ai/SimulateProgress";
import { getTemplate } from "@/components/templates/registry";
import { coerceSimulatedCV, gapAnalysis, targetMatch } from "@/lib/ai/simulate";
import { analyzeTone, type ToneLabel, type ToneProfile } from "@/lib/ai/retone";
import { applyRefinePatch } from "@/lib/ai/refinePatch";
import { factGround, parseModelJSON, scoreGrounding, RefineParseError } from "@/lib/ai/guardrails";
import { cvContentSig } from "@/lib/ai/judge";
import { PROVIDERS, type RefineResponse } from "@/lib/ai/types";
import { type CVData } from "@/lib/cv/schema";
import { NoticeSlot, type SimNotice } from "@/components/ai/simulate/NoticeSlot";
import { VerdictStrip } from "@/components/ai/simulate/VerdictStrip";
import { rankMissingSections, rankMissingSkills } from "@/lib/ai/simulateImpact";
import { buildGapReportHtml } from "@/lib/ai/simulateReport";
import { DiffView } from "./simulate/DiffView";
import { GapPanel } from "@/components/ai/simulate/GapPanel";

/** Always read the working CV from the store at call time (edits + applied refine). */
function liveWorkingCV(): CVData {
  return useCVStore.getState().cv;
}

const TONE_OPTIONS: ToneLabel[] = ["Executive", "Technical", "Balanced"];

type RetonePhase = "idle" | "running" | "error" | "preview";

export function TargetView() {
  const cv = useCVStore((s) => s.cv);
  const activeTemplate = useCVStore((s) => s.activeTemplate);
  const applyRefinedCV = useCVStore((s) => s.applyRefinedCV);
  const setSkillSuggestions = useCVStore((s) => s.setSkillSuggestions);
  const setView = useViewStore((s) => s.setView);
  const ideal = useTargetStore((s) => s.ideal);
  const jd = useTargetStore((s) => s.jd);
  const setJd = useTargetStore((s) => s.setJd);
  const setTarget = useTargetStore((s) => s.setTarget);
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
  const models = useSettingsStore((s) => s.models);
  const plan = usePlanStore((s) => s.plan);

  // Deterministic read of the target's writing voice (recomputed per target).
  const detected = useMemo<ToneProfile | null>(() => (ideal ? analyzeTone(ideal) : null), [ideal]);
  const [toneLabel, setToneLabel] = useState<ToneLabel | null>(null);
  const [phase, setPhase] = useState<RetonePhase>("idle");
  const [err, setErr] = useState<{ title: string; body: string; status?: number } | null>(null);
  const [preview, setPreview] = useState<{ cv: CVData; warnings: string[] } | null>(null);
  const [showBefore, setShowBefore] = useState(false);
  const [compare, setCompare] = useState<"yours" | "ideal" | "both" | "diff">("both");
  /** Working-CV fingerprint the open retone preview was built from. */
  const previewBaseSig = useRef<string | null>(null);

  // Generator (formerly the standalone Simulate view): building the ideal CV
  // happens inline here, so Target is a single destination with no bounce.
  const [recompose, setRecompose] = useState(false);
  const [genPhase, setGenPhase] = useState<"input" | "running" | "error">("input");
  const [genErr, setGenErr] = useState<{ title: string; body: string; status?: number } | null>(null);
  const [usageNote, setUsageNote] = useState<string | null>(null);
  const simRunning = useIsRunning("simulate");
  const simOrigin = useRunOrigin("simulate");
  const simStartedAt = useRunStore((s) => s.active["simulate"]?.startedAt);

  const meta = PROVIDERS[provider];
  const cvSig = useMemo(() => cvContentSig(cv), [cv]);

  // Drop stale retone previews when the working CV changes (edit or apply refine).
  useEffect(() => {
    if (!preview || !previewBaseSig.current) return;
    if (previewBaseSig.current === cvSig) return;
    previewBaseSig.current = null;
    setPreview(null);
    setPhase("idle");
    setShowBefore(false);
  }, [cvSig, preview]);

  // Keep editor skill chips aligned with the live gap vs the locked ideal.
  useEffect(() => {
    if (!ideal) return;
    setSkillSuggestions(gapAnalysis(cv, ideal).missingSkills);
  }, [cv, ideal, setSkillSuggestions]);

  // Record the live score (debounced) so the verdict strip can show progress.
  useEffect(() => {
    if (!ideal) return;
    const id = setTimeout(() => recordScore(targetMatch(cv, ideal, jd).score), 800);
    return () => clearTimeout(id);
  }, [cv, ideal, jd, recordScore]);

  const MineTpl = getTemplate(activeTemplate).Component;

  async function generate() {
    if (!jd.trim()) return;
    setGenPhase("running");
    setGenErr(null);
    try {
      const data = await sharedRun<RefineResponse>("simulate", "Target", () =>
        fetch("/api/ai/simulate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ provider, model: models[provider], jobDescription: jd }),
        }).then((r) => r.json() as Promise<RefineResponse>),
      );
      if (!data.ok || !data.raw) {
        setGenErr({ title: `${meta.label} error`, body: data.error?.message ?? "Unknown error.", status: data.error?.status });
        setGenPhase("error");
        return;
      }
      const built = coerceSimulatedCV(data.raw);
      // Baseline + chips must use the *current* working CV (edits + applied refine),
      // not a render-closure snapshot from when the button was mounted.
      const working = liveWorkingCV();
      const locked = targetMatch(working, built, jd);
      setTarget(built, jd, locked.score);
      useCVStore.getState().setSkillSuggestions(locked.gap.missingSkills);
      previewBaseSig.current = null;
      setPreview(null);
      setPhase("idle");
      setRecompose(false);
      setGenPhase("input");
      // Refresh the usage mirror (feature grey-out) and surface how many
      // simulations remain (point 9).
      void useUsageStore.getState().refresh().then(() => {
        const u = useUsageStore.getState().summary;
        if (u) setUsageNote(remainingNote("simulate", u.metrics.simulate.cap, u.metrics.simulate.used) || null);
      });
    } catch (e) {
      const msg = e instanceof RefineParseError ? e.message : e instanceof Error ? e.message : String(e);
      setGenErr({ title: "Could not build the simulation", body: msg });
      setGenPhase("error");
    }
  }

  const showGenerator = !ideal || recompose;
  if (showGenerator) {
    const busyElsewhere = simRunning && genPhase !== "running";
    const running = genPhase === "running" || busyElsewhere;
    return (
      <motion.div
        className="ws-view tgt-view"
        initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="ws-head">
          <div>
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

        {genPhase === "error" && genErr ? (
          <>
            <div className="imp-error">
              <strong>{genErr.title}{genErr.status ? ` (HTTP ${genErr.status})` : ""}</strong>
              <pre>{genErr.body}</pre>
            </div>
            <div className="imp-actions">
              <button className="imp-btn" onClick={() => setGenPhase("input")}>Back</button>
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
              disabled={genPhase === "running"}
            />
            {running && <SimulateProgress startedAt={simStartedAt} />}
            <div className="imp-actions">
              <button
                className="imp-btn"
                onClick={() => (recompose ? setRecompose(false) : setView("edit"))}
              >
                {recompose ? "Keep current target" : "Cancel"}
              </button>
              <button className="imp-btn primary" onClick={generate} disabled={running || !jd.trim()}>
                {genPhase === "running" ? (
                  <><span className="cmp-spinner" /> Building ideal candidate…</>
                ) : busyElsewhere ? (
                  <><span className="cmp-spinner" /> Simulating{simOrigin ? ` · from ${simOrigin}` : ""}…</>
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

  const activeTone: ToneLabel = toneLabel ?? detected?.label ?? "Balanced";

  function exportReport() {
    const html = buildGapReportHtml({ label: label || "Target role", match, baseScore, rankedSkills, rankedSections });
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  const openResim = () => { setRecompose(true); setGenPhase("input"); setGenErr(null); };
  const notices: SimNotice[] = [];
  if (usageNote) notices.push({ id: "usage", body: usageNote });
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
      body: <><strong>The job description changed</strong> since this target was simulated (it is shared with Refine). Re-simulate to benchmark against the current JD.</>,
      actions: <button className="imp-btn primary" onClick={openResim}>Re-simulate with current JD</button>,
    });
  }

  // What the left column shows: the retoned preview when one exists (and the
  // user isn't peeking at the original), otherwise the live CV.
  const leftCV = preview && !showBefore ? preview.cv : cv;
  const previewMatch = preview ? targetMatch(preview.cv, ideal, jd) : null;
  const fidelity = preview ? scoreGrounding({ cv: preview.cv, warnings: preview.warnings }) : null;

  async function runRetone() {
    if (!detected) return;
    setPhase("running");
    setErr(null);
    setPreview(null);
    previewBaseSig.current = null;
    setShowBefore(false);
    const tone: ToneProfile = { ...detected, label: activeTone };
    // Snapshot the latest working CV at request time (post-refine/edit).
    const source = liveWorkingCV();
    const sourceSig = cvContentSig(source);
    try {
      const data = await sharedRun<RefineResponse>("retone", "Target", () =>
        fetch("/api/ai/retone", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ provider, model: models[provider], cv: source, tone }),
        }).then((r) => r.json() as Promise<RefineResponse>),
      );
      if (!data.ok || !data.raw) {
        setErr({
          title: `${meta.label} error`,
          body: data.error?.message ?? "Unknown error.",
          status: data.error?.status,
        });
        setPhase("error");
        return;
      }
      // If the working CV changed while retone was in flight, discard the result
      // so we never ground/apply against a superseded document.
      if (cvContentSig(liveWorkingCV()) !== sourceSig) {
        setErr({
          title: "CV changed during rewrite",
          body: "Your CV was updated (edit or applied refine) while the rewrite ran. Run rewrite again on the latest version.",
        });
        setPhase("error");
        return;
      }
      // Tone transfer changes VOICE only: drop any title/role the model emitted
      // so the person's headline and every role title stay exactly as the source.
      const patch = parseModelJSON(data.raw) as Record<string, unknown>;
      delete patch.title;
      for (const key of ["experience", "projects"] as const) {
        const arr = patch[key];
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (item && typeof item === "object") delete (item as { role?: unknown }).role;
          }
        }
      }
      const grounded = factGround(source, applyRefinePatch(source, patch));
      previewBaseSig.current = sourceSig;
      setPreview({ cv: grounded.cv, warnings: grounded.warnings });
      setPhase("preview");
    } catch (e) {
      const msg = e instanceof RefineParseError ? e.message : e instanceof Error ? e.message : String(e);
      setErr({ title: "Could not rewrite the CV", body: msg });
      setPhase("error");
    }
  }

  function applyRetone() {
    if (!preview) return;
    applyRefinedCV(preview.cv);
    previewBaseSig.current = null;
    setPreview(null);
    setPhase("idle");
    setShowBefore(false);
  }

  function discardRetone() {
    previewBaseSig.current = null;
    setPreview(null);
    setPhase("idle");
    setShowBefore(false);
    setErr(null);
  }

  return (
    <motion.div
      className="ws-view tgt-view"
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ws-head">
        <div>
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
              <button role="tab" aria-selected={false} onClick={() => { discardRetone(); switchTarget(t.id); }}>{t.label}</button>
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
            <button className="imp-btn" onClick={() => setView("refine")}>Refine to JD</button>
            <button className="imp-btn primary" onClick={() => setView("edit")}>Edit my CV</button>
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
                    onClick={() => setToneLabel(t)}
                    disabled={phase === "running"}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="tone-hint">
                Voice only — your employers, dates, numbers, and skills stay exactly as they are. The
                target&apos;s metrics are never borrowed.
              </p>
              <button
                className="imp-btn accent sim-voice-run"
                onClick={runRetone}
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
                <button className="imp-btn" onClick={discardRetone}>Dismiss</button>
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
                {m === "yours" ? "Yours" : m === "ideal" ? "Ideal" : m === "both" ? "Side by side" : "Diff"}
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
                  <div className="tgt-paper"><MineTpl cv={leftCV} /></div>
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
                  <div className="tgt-paper"><IdealTpl cv={ideal} /></div>
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
                    onMouseDown={() => setShowBefore(true)}
                    onMouseUp={() => setShowBefore(false)}
                    onMouseLeave={() => setShowBefore(false)}
                  >
                    {showBefore ? "Showing original" : "Hold to compare"}
                  </button>
                  <button className="imp-btn" onClick={discardRetone}>Discard</button>
                  <button className="imp-btn primary" onClick={applyRetone}>Apply to my CV</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
