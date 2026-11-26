"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCVStore } from "@/lib/store/cvStore";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { usePlanStore } from "@/lib/store/planStore";
import { useTargetStore, isIdealStale } from "@/lib/store/targetStore";
import { useUsageStore } from "@/lib/store/usageStore";
import { planQualityLabel, remainingNote } from "@/lib/plan/plan";
import { SECTION_LABELS, type SectionKey } from "@/lib/cv/schema";
import { gapAnalysis, targetMatch } from "@/lib/ai/simulate";
import { SIMULATE_STAGES, simulateProgressAt } from "@/lib/ai/simulateProgress";
import { rankMissingSections, rankMissingSkills } from "@/lib/ai/simulateImpact";
import { printGapReport } from "@/lib/ai/simulateReport";
import { diffCv } from "@/lib/ai/cvDiff";
import { TONE_OPTIONS, useRetone } from "@/lib/ai/useRetone";
import { useSimulateRun } from "@/lib/ai/useSimulateRun";
import { compareBullets } from "@/lib/v4/simulate";
import { useHydrated } from "@/lib/v4/useHydrated";
import { V4_COPILOT_HREF } from "@/lib/v4/nav";
import { Card } from "@/components/ui/Card";
import { MatchRing } from "@/components/ui/MatchRing";
import { V4ChangeList } from "./V4ChangeList";

const ORIGIN = "Simulate";
type CompareView = "side" | "gaps";

/** Simulate the gap: compare your CV with an example ideal candidate for a role. */
export function V4Simulate() {
  const hydrated = useHydrated();
  const started = useCVStore((s) => s.started);
  const ideal = useTargetStore((s) => s.ideal);
  const [recompose, setRecompose] = useState(false);
  const sim = useSimulateRun(ORIGIN);

  if (hydrated && !started) {
    return (
      <div className="v4-empty-state">
        <b>No CV to compare yet</b>
        <p>Add your CV first, then simulate it against a job description.</p>
        <Link href={V4_COPILOT_HREF} className="v4-link">Open Copilot</Link>
      </div>
    );
  }

  const showSetup = !ideal || recompose;
  return (
    <div className="v4-stack">
      {showSetup ? (
        <SetupView sim={sim} canKeep={recompose} onKeep={() => setRecompose(false)} onDone={() => setRecompose(false)} />
      ) : (
        <ResultView onNew={() => { setRecompose(true); sim.backToInput(); }} usageNote={sim.usageNote} />
      )}
    </div>
  );
}

type Sim = ReturnType<typeof useSimulateRun>;

function Head({ title, sub, menu }: { title: string; sub: string; menu?: React.ReactNode }) {
  return (
    <header className="v4-head v4-sim-head">
      <div>
        <h2 className="v4-page-title">{title}</h2>
        <p>{sub}</p>
      </div>
      {menu}
    </header>
  );
}

function SetupView({ sim, canKeep, onKeep, onDone }: { sim: Sim; canKeep: boolean; onKeep: () => void; onDone: () => void }) {
  const jd = useTargetStore((s) => s.jd);
  const setJd = useTargetStore((s) => s.setJd);
  const plan = usePlanStore((s) => s.plan);
  const usage = useUsageStore((s) => s.summary?.metrics.simulate);
  const versionTitle = useLibraryStore((s) => s.versions.find((v) => v.id === s.activeId)?.name);
  const cvName = useCVStore((s) => s.cv.basics.title).trim();
  const [name, setName] = useState("");

  async function run() {
    if (await sim.generate(name)) onDone();
  }
  const using = versionTitle || cvName || "Your current CV";
  const allowance = usage ? remainingNote("simulate", usage.cap, usage.used) : "";

  return (
    <>
      <Head title="Simulate the gap" sub="See how your CV compares with an ideal candidate for the role, then close the gaps that matter." />
      <div className="v4-sim-grid">
        <Card pad>
          <h2 className="v4-h2">Set up a simulation</h2>
          <div className="v4-form">
            <label>
              Job description
              <textarea rows={8} value={jd} onChange={(e) => setJd(e.target.value)} disabled={sim.running} placeholder="Paste the full job posting here." />
              <span className="v4-hint">The more detail, the better the comparison.</span>
            </label>
            <label>
              Name this target
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={sim.running} placeholder="For example: Stripe, Senior Frontend" />
              <span className="v4-hint">Shown on a tab, so you can compare roles. Leave it blank to name it from the role.</span>
            </label>
            <div className="v4-using">
              <span><b>Using: {using}</b><small>{versionTitle ? "Your active CV version" : "The CV in your studio"}</small></span>
              <Link href="/v4/library" className="or-btn">Change</Link>
            </div>
            <div className="v4-sim-run">
              <button type="button" className="or-btn or-btn--primary" disabled={sim.running || !jd.trim()} onClick={() => void run()}>
                {sim.phase === "running" ? "Building…" : sim.busyElsewhere ? `Simulating${sim.startedBy ? ` from ${sim.startedBy}` : ""}…` : "Run simulation"}
              </button>
              {canKeep && <button type="button" className="or-btn" onClick={onKeep}>Keep current target</button>}
              <span className="v4-hint">
                {allowance ? `${allowance} ` : "Uses 1 simulation. "}
                {planQualityLabel(plan)} plan. <Link href="/pricing" className="v4-link">See plans</Link>
              </span>
            </div>
          </div>
        </Card>
        {sim.phase === "error" && sim.err ? (
          <Card pad>
            <h2 className="v4-h2">{sim.err.title}</h2>
            <p className="v4-muted" role="alert">{sim.err.body}</p>
            <button type="button" className="or-btn" onClick={sim.backToInput}>Back</button>
          </Card>
        ) : sim.running ? (
          <RunningCard startedAt={sim.startedAt} />
        ) : (
          <Card pad>
            <h2 className="v4-h2">How it works</h2>
            <ol className="v4-steps">
              <li>We build an example of the ideal candidate for this job.</li>
              <li>We compare it with your CV on skills, keywords, sections and measurable results.</li>
              <li>You get ranked gaps to close. Nothing is added to your CV unless you choose it.</li>
            </ol>
            <p className="v4-hint">Scores are Orire guidance, not an employer or ATS assessment.</p>
          </Card>
        )}
      </div>
    </>
  );
}

function RunningCard({ startedAt }: { startedAt?: number }) {
  const [t0] = useState(() => startedAt ?? Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 400);
    return () => window.clearInterval(id);
  }, []);
  const { percent, label, slow } = simulateProgressAt(now - t0);
  return (
    <Card pad>
      <h2 className="v4-h2">Running your simulation</h2>
      <div className="v4-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Simulation progress"><span style={{ width: `${percent}%` }} /></div>
      <div className="v4-sim-pct"><span>{label}</span><span>About {percent}%</span></div>
      <ul className="v4-stages">
        {SIMULATE_STAGES.map((s, i) => {
          const done = percent >= s.upTo;
          return <li key={i} className={done ? "done" : ""}><i aria-hidden>{done ? "✓" : ""}</i>{s.label.replace(/…$/, "")}</li>;
        })}
      </ul>
      <p className="v4-hint">{slow ? "Still working. Longer job descriptions take more time." : "The percentage is an estimate. It reaches 100% when your result arrives, usually under a minute."}</p>
    </Card>
  );
}

function ResultView({ onNew, usageNote }: { onNew: () => void; usageNote: string | null }) {
  const router = useRouter();
  const cv = useCVStore((s) => s.cv);
  const ideal = useTargetStore((s) => s.ideal);
  const jd = useTargetStore((s) => s.jd);
  const label = useTargetStore((s) => s.label);
  const baseScore = useTargetStore((s) => s.baseScore);
  const history = useTargetStore((s) => s.history);
  const saved = useTargetStore((s) => s.saved);
  const jdStale = useTargetStore(isIdealStale);
  const resimPrompt = useTargetStore((s) => s.resimPrompt);
  const dismissResim = useTargetStore((s) => s.dismissResim);
  const switchTarget = useTargetStore((s) => s.switchTarget);
  const removeSaved = useTargetStore((s) => s.removeSaved);
  const recordScore = useTargetStore((s) => s.recordScore);
  const discardTarget = useTargetStore((s) => s.discardTarget);
  const setSkillSuggestions = useCVStore((s) => s.setSkillSuggestions);
  const acceptSkill = useCVStore((s) => s.acceptSkillSuggestion);
  const addSection = useCVStore((s) => s.addSuggestedSection);
  const retone = useRetone(ideal, jd, ORIGIN);
  const [view, setView] = useState<CompareView>("side");
  const [menu, setMenu] = useState(false);

  // Keep the studio's skill chips aligned with this gap, and record the live
  // score (debounced) so the history line shows progress as you edit.
  useEffect(() => {
    if (ideal) setSkillSuggestions(gapAnalysis(cv, ideal).missingSkills, ideal.skills);
  }, [cv, ideal, setSkillSuggestions]);
  useEffect(() => {
    if (!ideal) return;
    const id = setTimeout(() => recordScore(targetMatch(cv, ideal, jd).score), 800);
    return () => clearTimeout(id);
  }, [cv, ideal, jd, recordScore]);

  const match = useMemo(() => (ideal ? targetMatch(cv, ideal, jd) : null), [cv, ideal, jd]);
  const rankedSkills = useMemo(() => (ideal ? rankMissingSkills(cv, ideal, jd) : []), [cv, ideal, jd]);
  const rankedSections = useMemo(() => (ideal ? rankMissingSections(cv, ideal, jd) : []), [cv, ideal, jd]);
  if (!ideal || !match) return null;

  const gap = match.gap;
  const gain = match.score - baseScore;
  const pair = compareBullets(cv, ideal);
  const changes = retone.preview ? diffCv(cv, retone.preview.cv) : [];
  const staleNote = resimPrompt
    ? "Your CV changed after a refinement. Re-simulate to benchmark the new version."
    : jdStale ? "The job description changed since this simulation. Re-simulate to compare against it." : "";

  return (
    <>
      <Head
        title="Simulate the gap"
        sub={`Your latest CV against an example ideal candidate for ${label || "this role"}.`}
        menu={
          <div className="v4-menu">
            <button type="button" className="or-btn" aria-label="More actions" aria-expanded={menu} onClick={() => setMenu((o) => !o)}>⋯</button>
            {menu && (
              <div className="v4-menu-list" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenu(false); onNew(); }}>New simulation</button>
                <button type="button" role="menuitem" onClick={() => { setMenu(false); printGapReport({ label: label || "Target role", match, baseScore, rankedSkills, rankedSections }); }}>Gap report (PDF)</button>
                <button type="button" role="menuitem" className="danger" onClick={() => { setMenu(false); discardTarget(); }}>Clear target</button>
              </div>
            )}
          </div>
        }
      />

      <div className="v4-chips" role="tablist" aria-label="Targets">
        {saved.map((t) => (
          <span key={t.id} className="v4-chip-x">
            <button type="button" role="tab" aria-selected={false} className="v4-chip" onClick={() => { retone.discard(); switchTarget(t.id); }}>{t.label}</button>
            <button type="button" aria-label={`Remove ${t.label}`} onClick={() => removeSaved(t.id)}>×</button>
          </span>
        ))}
        <button type="button" role="tab" aria-selected className="v4-chip on">{label || "This role"}</button>
        <button type="button" className="v4-chip" onClick={onNew}>+ New simulation</button>
      </div>

      {usageNote && <p className="v4-note" role="status">{usageNote}</p>}
      {staleNote && (
        <div className="v4-note" role="status">
          <span><b>{staleNote.split(".")[0]}.</b> {staleNote.split(".").slice(1).join(".").trim()}</span>
          <span className="v4-note-actions">
            {resimPrompt && <button type="button" className="or-btn" onClick={dismissResim}>Not now</button>}
            <button type="button" className="or-btn or-btn--primary" onClick={() => { dismissResim(); onNew(); }}>Re-simulate</button>
          </span>
        </div>
      )}

      <div className="v4-sim-top">
        <Card pad>
          <div className="v4-sim-score">
            <MatchRing value={match.score} tone="gold" size={132} />
            <div className="v4-metrics">
              {match.metrics.map((m) => (
                <div key={m.key} className="v4-metric">
                  <div><b>{m.label}</b><span>{m.score}%</span></div>
                  <div className="v4-meter"><span className={m.score >= 70 ? "ok" : m.score >= 55 ? "mid" : "low"} style={{ width: `${m.score}%` }} /></div>
                  <small>{m.hint}</small>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card pad>
          <h2 className="v4-h2">Score history</h2>
          <p className="v4-muted">
            {gain === 0 ? "Your score matches your first simulation for this role." : <><b>{gain > 0 ? "+" : ""}{gain} points</b> since your first simulation for this role.</>}
          </p>
          <Spark history={history.map((h) => h.score)} />
          <div className="v4-sim-actions">
            <button type="button" className="or-btn gold" onClick={() => router.push("/v4/studio")}>Rewrite to the role</button>
            <button type="button" className="or-btn or-btn--primary" onClick={() => router.push("/v4/studio")}>Edit my CV</button>
          </div>
        </Card>
      </div>

      <div className="v4-sim-mid">
        <Card pad>
          <h2 className="v4-h2">Biggest wins</h2>
          <p className="v4-muted">Skills the role asks for that your CV doesn’t show, ranked by how much each would lift your score. Only add what you have really done.</p>
          {rankedSkills.length === 0 && rankedSections.length === 0 ? (
            <p className="v4-muted">No gaps found against this role.</p>
          ) : (
            <ul className="v4-wins">
              {rankedSkills.map((s) => (
                <li key={s.skill}>
                  <span><b>{s.skill}</b></span>
                  {s.impact > 0 && <em className="v4-pts">+{s.impact} pts</em>}
                  <button type="button" className="or-btn" onClick={() => acceptSkill(s.skill)}>Add skill</button>
                </li>
              ))}
              {rankedSections.map((s) => (
                <li key={s.key}>
                  <span><b>Missing section: {SECTION_LABELS[s.key as SectionKey]}</b><small>The reference CV has one.</small></span>
                  {s.impact > 0 && <em className="v4-pts">+{s.impact} pts</em>}
                  <button type="button" className="or-btn" onClick={() => addSection(s.key as SectionKey)}>Add section</button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="v4-sim-side">
          <Card pad>
            <h2 className="v4-h2">Match the role’s voice</h2>
            <p className="v4-muted">Rewrite your bullets in a tone close to the job description. You review the changes before anything is applied.</p>
            <div className="v4-seg" role="group" aria-label="Rewrite voice">
              {TONE_OPTIONS.map((t) => (
                <button key={t} type="button" className={retone.activeTone === t ? "on" : ""} aria-pressed={retone.activeTone === t} disabled={retone.phase === "running"} onClick={() => retone.setToneLabel(t)}>{t}</button>
              ))}
            </div>
            <button type="button" className="or-btn" disabled={retone.phase === "running" || !retone.detected} onClick={() => void retone.run()}>
              {retone.phase === "running" ? "Rewriting…" : "Preview rewrite"}
            </button>
            <p className="v4-hint">Voice only. Your employers, dates, numbers and skills stay as they are.</p>
            {retone.phase === "error" && retone.err && (
              <p className="v4-muted" role="alert"><b>{retone.err.title}.</b> {retone.err.body} <button type="button" className="v4-link" onClick={retone.discard}>Dismiss</button></p>
            )}
          </Card>
          <Card pad>
            <h2 className="v4-h2">Gap report</h2>
            <p className="v4-muted">A PDF of this comparison to keep or share with a mentor.</p>
            <button type="button" className="or-btn" onClick={() => printGapReport({ label: label || "Target role", match, baseScore, rankedSkills, rankedSections })}>Download gap report (PDF)</button>
          </Card>
        </div>
      </div>

      {retone.phase === "preview" && retone.preview && (
        <Card pad>
          <h2 className="v4-h2">Rewritten in a {retone.activeTone.toLowerCase()} voice</h2>
          <p className="v4-muted">
            {retone.previewMatch && retone.previewMatch.score !== match.score
              ? `Match ${retone.previewMatch.score > match.score ? "rises" : "falls"} by ${Math.abs(retone.previewMatch.score - match.score)} points. ` : ""}
            {retone.fidelity ? `${retone.fidelity.score}% grounded in your real facts.` : ""}
          </p>
          <div className="v4-changes">
            <V4ChangeList changes={changes} />
            {changes.length === 0 && <p className="v4-muted">The rewrite didn’t change anything.</p>}
          </div>
          <div className="v4-sim-actions">
            <button type="button" className="or-btn gold" disabled={changes.length === 0} onClick={retone.apply}>Apply to my CV</button>
            <button type="button" className="or-btn" onClick={retone.discard}>Discard</button>
          </div>
        </Card>
      )}

      <Card pad>
        <div className="v4-compare-head">
          <h2 className="v4-h2">Compare</h2>
          <div className="v4-seg" role="tablist" aria-label="Compare view">
            <button type="button" role="tab" aria-selected={view === "side"} className={view === "side" ? "on" : ""} onClick={() => setView("side")}>Side by side</button>
            <button type="button" role="tab" aria-selected={view === "gaps"} className={view === "gaps" ? "on" : ""} onClick={() => setView("gaps")}>Gaps only</button>
          </div>
        </div>
        <div className="v4-compare">
          {view === "side" ? (
            <>
              <div className="v4-compare-col">
                <div><b>Your CV</b><em className="v4-pts">{gap.matchedSkills.length} matched</em></div>
                <div className="v4-skillchips">{gap.matchedSkills.map((s) => <span key={s} className="ok">{s}</span>)}</div>
                {pair.yours && <p>“{pair.yours}”</p>}
                {pair.yoursLacksNumber && <small className="low">No number on this bullet</small>}
              </div>
              <div className="v4-compare-col">
                <div><b>Simulated reference</b><em className="v4-pts gold">Ideal for this role</em></div>
                <div className="v4-skillchips">
                  {gap.matchedSkills.map((s) => <span key={s}>{s}</span>)}
                  {gap.missingSkills.map((s) => <span key={s} className="gap">{s}</span>)}
                </div>
                {pair.reference && <p>“{pair.reference}”</p>}
                <small>An example of the level to aim for. Not text to copy.</small>
              </div>
            </>
          ) : (
            <div className="v4-compare-col v4-compare-wide">
              <div><b>What’s missing</b></div>
              <div className="v4-skillchips">
                {gap.missingSkills.map((s) => <span key={s} className="gap">{s}</span>)}
                {gap.missingSections.map((k) => <span key={k} className="gap">{SECTION_LABELS[k as SectionKey] ?? k} section</span>)}
              </div>
              {gap.missingSkills.length === 0 && gap.missingSections.length === 0 && <p>No gaps found against this role.</p>}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

function Spark({ history }: { history: number[] }) {
  const pts = history.length > 1 ? history : [history[0] ?? 0, history[0] ?? 0];
  const w = 360, h = 90;
  const lo = Math.min(...pts, 40), hi = Math.max(...pts, 80);
  const xy = pts.map((v, i) => [12 + (i * (w - 24)) / (pts.length - 1), h - 10 - ((v - lo) / (hi - lo)) * (h - 24)] as const);
  return (
    <svg className="v4-spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Score history: ${pts.join(", ")}`}>
      <polyline points={xy.map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join(" ")} fill="none" strokeWidth="2" />
      {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === xy.length - 1 ? 5 : 3.5} className={i === xy.length - 1 ? "now" : ""} />)}
    </svg>
  );
}
