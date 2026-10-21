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
import { SECTION_LABELS, type CVData, type SectionKey } from "@/lib/cv/schema";

/** Always read the working CV from the store at call time (edits + applied refine). */
function liveWorkingCV(): CVData {
  return useCVStore.getState().cv;
}

function coverageColor(v: number): string {
  const hue = Math.round((v / 100) * 130);
  return `hsl(${hue} 70% 45%)`;
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
  const delta = match.score - baseScore;
  const IdealTpl = getTemplate(activeTemplate).Component;
  const dateLabel = createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";

  const activeTone: ToneLabel = toneLabel ?? detected?.label ?? "Balanced";

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
            Your latest working CV (edits and applied refine) beside the ideal for{" "}
            <strong>{label || "this role"}</strong>
            {dateLabel ? ` · locked ${dateLabel}` : ""}. Match and gaps recompute on every change.
          </p>
        </div>
      </div>

      {usageNote && (
        <div className="usage-note" role="status">{usageNote}</div>
      )}

      {jdStale && !resimPrompt && (
        <div className="usage-note" role="status">
          <strong>The job description changed</strong> since this target was simulated (it is shared with Refine). Re-simulate to benchmark against the current JD.
          <div className="imp-actions">
            <button
              className="imp-btn primary"
              onClick={() => { setRecompose(true); setGenPhase("input"); setGenErr(null); }}
            >
              Re-simulate with current JD
            </button>
          </div>
        </div>
      )}

      {resimPrompt && (
        <div className="usage-note" role="status">
          <strong>Your CV changed after a refinement.</strong> Re-simulate to benchmark the new version against the latest job description?
          <div className="imp-actions">
            <button className="imp-btn" onClick={dismissResim}>Not now</button>
            <button
              className="imp-btn primary"
              onClick={() => { dismissResim(); setRecompose(true); setGenPhase("input"); setGenErr(null); }}
            >
              Re-simulate with my new CV
            </button>
          </div>
        </div>
      )}

      <p className="score-disclosure" id="target-score-explainer">\n        <strong>About this score:</strong> Orire compares your CV with an AI-generated example and signals from the pasted job description. It is an illustrative benchmark, not an employer decision, ATS pass rate, or prediction of interviews. Only include skills and achievements you actually have.\n      </p>\n\n      <div className="tgt-meter" aria-describedby="target-score-explainer">
        <div className="sim-cov">
          <svg viewBox="0 0 84 84" width="84" height="84" className="sim-cov-svg">
            <circle cx="42" cy="42" r="34" className="rate-ring-track" />
            <motion.circle
              cx="42"
              cy="42"
              r="34"
              className="rate-ring-fill"
              stroke={coverageColor(match.score)}
              strokeDasharray={2 * Math.PI * 34}
              initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - match.score / 100) }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </svg>
          <div className="sim-cov-center">
            <strong style={{ color: coverageColor(match.score) }}>{match.score}%</strong>
          </div>
          <span className="rate-ring-label">Simulated match</span>
        </div>

        <div className="tgt-meter-body">
          <div className="tgt-stat-row">
            {delta !== 0 ? (
              <span className={`tgt-stat ${delta > 0 ? "match" : "miss"}`}>
                {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}% since locked
              </span>
            ) : (
              <span className="tgt-stat">Baseline {baseScore}% when locked</span>
            )}
            <span className="tgt-stat match">{gap.matchedSkills.length} skills matched</span>
            <span className="tgt-stat miss">{gap.missingSkills.length} to add</span>
          </div>

          <div className="tgt-signals">
            {match.metrics.map((m) => (
              <div key={m.key} className="tgt-signal" title={m.hint}>
                <span className="tgt-signal-label">{m.label}</span>
                <span className="tgt-signal-bar">
                  <motion.span
                    className="tgt-signal-fill"
                    style={{ background: coverageColor(m.score) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${m.score}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </span>
                <span className="tgt-signal-val">{m.score}%</span>
              </div>
            ))}
          </div>

          {gap.missingSkills.length > 0 ? (
            <div className="tgt-chips">
              {gap.missingSkills.slice(0, 18).map((s) => (
                <span key={s} className="sim-chip miss">{s}</span>
              ))}
              {gap.missingSkills.length > 18 && (
                <span className="sim-chip miss">+{gap.missingSkills.length - 18} more</span>
              )}
            </div>
          ) : (
            <p className="sim-perfect">You cover every skill in the target. 🎯</p>
          )}
          {gap.missingSections.length > 0 && (
            <div className="tgt-chips">
              {gap.missingSections.map((k) => (
                <span key={k} className="sim-chip miss">{SECTION_LABELS[k as SectionKey]}</span>
              ))}
            </div>
          )}
          <div className="tgt-actions">
            <button className="imp-btn primary" onClick={() => setView("edit")}>Edit my CV</button>
            <button
              className="imp-btn accent"
              onClick={runRetone}
              disabled={phase === "running"}
              title={`Rewrite your CV in the target's ${activeTone.toLowerCase()} voice — facts stay yours`}
            >
              {phase === "running" ? (
                <><span className="cmp-spinner" /> Rewriting…</>
              ) : (
                <>✍️ Rewrite in target&apos;s tone</>
              )}
            </button>
            <button className="imp-btn" onClick={() => setView("refine")}>Refine to JD</button>
            <button className="imp-btn" onClick={() => { setRecompose(true); setGenPhase("input"); setGenErr(null); }}>New simulation</button>
            <button className="imp-btn danger" onClick={clearTarget}>Clear target</button>
          </div>

          {detected && (
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
            </div>
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

          <AnimatePresence>
            {phase === "preview" && preview && previewMatch && fidelity && (
              <motion.div
                key="tone-apply"
                className="tone-applybar"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
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

      <div className="tgt-split">
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
      </div>
    </motion.div>
  );
}
