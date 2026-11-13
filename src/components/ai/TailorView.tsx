"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useSession } from "next-auth/react";
import { useCVStore } from "@/lib/store/cvStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { usePlanStore } from "@/lib/store/planStore";
import { useUsageStore } from "@/lib/store/usageStore";
import { useUIStore } from "@/lib/store/uiStore";
import { useViewStore, type WorkspaceView } from "@/lib/store/viewStore";
import { ACCOUNT_VIEWS, VIEW_META } from "@/lib/store/viewMeta";
import { allowCoach, type Metric } from "@/lib/plan/plan";
import { jdMatch } from "@/lib/ai/jdmatch";
import { suggestTailorStep, type TailorStep } from "@/lib/tailor/suggestStep";
import { ViewIcon } from "@/components/ViewIcon";
import { RunAllPanel } from "@/components/ai/RunAll";
import { TailorFacts } from "@/components/ai/TailorFacts";
import { TailorInbox } from "@/components/ai/TailorInbox";

type Tool = "target" | "coach" | "refine";

const TOOLS: { view: Tool; verb: string; text: string; metric?: Metric }[] = [
  { view: "target", verb: "Diagnose", text: "See how close you are to an ideal candidate for this job and where the gaps are.", metric: "simulate" },
  { view: "coach", verb: "Interview", text: "Answer a few targeted questions so real achievements and numbers fill the gaps." },
  { view: "refine", verb: "Polish", text: "Tailor the wording to the job, using only facts already on your CV.", metric: "refine" },
];

const STEP_VIEW: Record<Exclude<TailorStep, "job">, WorkspaceView> = {
  simulate: "target",
  coach: "coach",
  refine: "refine",
  export: "export",
};

const MAX_MISSING_SHOWN = 16;

function useOpenTool() {
  const setView = useViewStore((s) => s.setView);
  const openAuth = useUIStore((s) => s.openAuth);
  const { status } = useSession();
  return (view: WorkspaceView) => {
    const reason = status === "unauthenticated" ? ACCOUNT_VIEWS[view] : undefined;
    if (reason) openAuth("signup", null, reason);
    else setView(view);
  };
}

function ToolCard({ tool, suggested }: { tool: (typeof TOOLS)[number]; suggested: boolean }) {
  const open = useOpenTool();
  const setView = useViewStore((s) => s.setView);
  const plan = usePlanStore((s) => s.plan);
  const spent = useUsageStore((s) => (tool.metric ? s.exhausted(tool.metric) : false));
  const label = VIEW_META[tool.view].label;
  const proOnly = tool.view === "coach" && !allowCoach(plan);

  return (
    <li className={`tailor-tool${suggested ? " is-suggested" : ""}${spent ? " is-locked" : ""}`}>
      <span className="tailor-tool-icon" aria-hidden><ViewIcon view={tool.view} /></span>
      <div className="tailor-tool-main">
        <strong>
          {label} <span className="tailor-tool-name">· {tool.verb}</span>
          {suggested && <span className="tailor-tool-next"> Suggested next</span>}
          {proOnly && <span className="tailor-tool-plan"> Pro</span>}
        </strong>
        <p>{spent ? "Free limit reached. Upgrade to keep using this." : tool.text}</p>
      </div>
      <button
        type="button"
        className={`flow-btn${suggested ? " primary" : ""}`}
        aria-label={spent ? `${label} — free limit reached, upgrade to continue` : `Open ${label}`}
        onClick={() => (spent ? setView("plans") : open(tool.view))}
      >
        {spent ? "Upgrade" : `Open ${label}`}
      </button>
    </li>
  );
}

export function TailorView() {
  const reducedMotion = useReducedMotion();
  const cv = useCVStore((s) => s.cv);
  const started = useCVStore((s) => s.started);
  const refined = useCVStore((s) => s.baseline !== null);
  const jd = useTargetStore((s) => s.jd);
  const setJd = useTargetStore((s) => s.setJd);
  const simulated = useTargetStore((s) => s.ideal !== null);
  const open = useOpenTool();

  const hasJd = jd.trim().length > 0;
  const match = useMemo(() => (started && hasJd ? jdMatch(cv, jd) : null), [cv, jd, started, hasJd]);

  const suggestion = suggestTailorStep({
    hasCv: started,
    jd,
    simulated,
    missingCount: match?.missing.length ?? 0,
    refined,
  });
  const suggestedView = suggestion.step === "job" ? null : STEP_VIEW[suggestion.step];

  return (
    <motion.div
      className="ws-view tailor-view"
      initial={reducedMotion ? false : { opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: reducedMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ws-head">
        <div>
          <h2>Tailor to a job</h2>
          <p>Enter the job once. See where your CV stands, then diagnose, coach or refine it. Each tool reads the same job and never changes your CV without your approval.</p>
        </div>
      </div>

      <div className="step-body">
        <div className="ai-field">
          <label className="ed-label" htmlFor="tailor-jd">Job description</label>
          <textarea
            id="tailor-jd"
            className="ed-input ai-jd"
            value={jd}
            placeholder="Paste the full job description here…"
            onChange={(e) => setJd(e.target.value)}
            rows={8}
          />
        </div>

        {!started && (
          <p className="step-hint">
            Your CV is still the sample draft.{" "}
            <button type="button" className="tailor-link" onClick={() => open("edit")}>Add your CV</button>{" "}
            to see how it matches.
          </p>
        )}

        {match && (
          <section className="tailor-match" aria-labelledby="tailor-match-title">
            <h3 id="tailor-match-title">Where you stand</h3>
            <p className="tailor-score">
              <strong>{match.score}%</strong> of the job’s key terms appear on your CV.
              <span className="tailor-note"> A keyword check, not an ATS score or hiring prediction.</span>
            </p>
            {match.missing.length > 0 ? (
              <>
                <p className="tailor-sub">Not on your CV yet ({match.missing.length}). Add these only where they are true.</p>
                <ul className="tailor-chips" aria-label="Job terms missing from your CV">
                  {match.missing.slice(0, MAX_MISSING_SHOWN).map((k) => <li key={k}>{k}</li>)}
                  {match.missing.length > MAX_MISSING_SHOWN && <li className="more">+{match.missing.length - MAX_MISSING_SHOWN} more</li>}
                </ul>
              </>
            ) : (
              <p className="tailor-sub">Every key term from the job already appears on your CV.</p>
            )}
          </section>
        )}

        <p className="tailor-suggest" role="status">{suggestion.reason}</p>

        <RunAllPanel ready={started && hasJd} />

        <TailorInbox />
        <TailorFacts />

        <section aria-labelledby="tailor-tools-title">
          <h3 id="tailor-tools-title" className="tailor-tools-title">Run one tool</h3>
          <ul className="tailor-tools">
            {TOOLS.map((t) => (
              <ToolCard key={t.view} tool={t} suggested={suggestedView === t.view} />
            ))}
          </ul>
        </section>
      </div>
    </motion.div>
  );
}
