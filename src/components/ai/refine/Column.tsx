"use client";

import { motion } from "framer-motion";
import { useRefineStore, type ColState } from "@/lib/store/refineStore";
import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";
import { SECTION_LABELS, type SectionKey } from "@/lib/cv/schema";
import type { JDMatch } from "@/lib/ai/jdmatch";
import { gapAnalysis, type GapAnalysis } from "@/lib/ai/simulate";
import { countFacts, type FactCounts } from "./shared";

export function Column({ provider, state, before, applied, onApply }: { provider: ProviderId; state: ColState; before: FactCounts; applied: boolean; onApply: () => void }) {
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
          <div className="imp-actions cmp-actions">
            {applied ? (
              <button className="flow-btn applied" onClick={onApply} title="Re-apply this version to your CV">
                ✓ Applied to your CV
              </button>
            ) : (
              <button className="flow-btn primary" onClick={onApply}>Apply this</button>
            )}
          </div>
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
