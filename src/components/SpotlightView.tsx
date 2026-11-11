"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useViewStore, type WorkspaceView } from "@/lib/store/viewStore";
import { VIEW_META } from "@/lib/store/viewMeta";
import { useFlowStore, COMPOSABLE_BLOCKS } from "@/lib/store/flowStore";
import { useUsageStore } from "@/lib/store/usageStore";
import { useCVStore } from "@/lib/store/cvStore";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { recommendedNextBlock } from "@/lib/cv/recommendedNext";
import type { Metric } from "@/lib/plan/plan";
import { ViewIcon } from "@/components/ViewIcon";
import { getTemplateInfo } from "@/lib/templates/catalog";
import { useSession } from "next-auth/react";

/** Metered blocks that grey out / route to Plans once the free cap is spent. */
const METRIC_FOR_VIEW: Partial<Record<WorkspaceView, Metric>> = {
  refine: "refine",
  target: "simulate",
  export: "download",
};

/** Reads the live signals `recommendedNextBlock` decides on — see that
 *  function for why these three and not the rest of the grid. */
function useRecommendedNext(): WorkspaceView | null {
  const started = useCVStore((s) => s.started);
  const refined = useCVStore((s) => s.baseline !== null);
  const exported = useLibraryStore((s) => s.versions.some((v) => !!v.lastExportedAt));
  return recommendedNextBlock({ started, refined, exported });
}

function BlockCard({ view, recommended }: { view: WorkspaceView; recommended: boolean }) {
  const meta = VIEW_META[view];
  const setView = useViewStore((s) => s.setView);
  const inFlow = useFlowStore((s) => s.sequence.includes(view));
  const addBlock = useFlowStore((s) => s.addBlock);
  const removeBlock = useFlowStore((s) => s.removeBlock);
  const metric = METRIC_FOR_VIEW[view];
  const locked = useUsageStore((s) => (metric ? s.exhausted(metric) : false));

  return (
    <div className={`spot-card${locked ? " is-locked" : ""}${recommended ? " is-recommended" : ""}`}>
      <button
        type="button"
        className="spot-card-open"
        onClick={() => setView(locked ? "plans" : view)}
        aria-label={
          (locked ? `${meta.label} — free limit reached, upgrade to continue` : `Open ${meta.label}`) +
          (recommended ? " — recommended next" : "")
        }
      >
        <span className="spot-card-icon" aria-hidden><ViewIcon view={view} /></span>
        <span className="spot-card-text">
          <span className="spot-card-label">
            {meta.label}
            {locked && <span className="spot-card-lock" aria-hidden> 🔒</span>}
          </span>
          <span className="spot-card-hint">
            {recommended && <span className="spot-card-next">Recommended next · </span>}
            {locked ? "Free limit reached — upgrade to Pro." : meta.hint}
          </span>
        </span>
      </button>
      <button
        type="button"
        className={`spot-card-toggle${inFlow ? " in" : ""}`}
        aria-pressed={inFlow}
        onClick={() => (inFlow ? removeBlock(view) : addBlock(view))}
        title={inFlow ? "Remove from your flow" : "Add to your flow"}
      >
        {inFlow ? "In your flow ✓" : "Add +"}
      </button>
    </div>
  );
}

/** Simulate stays available alongside the user's existing CV workflow. */
function SimulateHero() {
  const setView = useViewStore((s) => s.setView);
  const inFlow = useFlowStore((s) => s.sequence.includes("target"));
  const addBlock = useFlowStore((s) => s.addBlock);
  const removeBlock = useFlowStore((s) => s.removeBlock);
  const locked = useUsageStore((s) => s.exhausted("simulate"));

  return (
    <div className="spot-hero">
      <div className="spot-hero-main">
                <strong className="spot-hero-title">
          <ViewIcon view="target" /> {VIEW_META.target.label} the ideal candidate
        </strong>
        <span className="spot-hero-sub">
          See how your CV lines up against an illustrative role profile. It is guidance, not an employer assessment.
        </span>
      </div>
      <div className="spot-hero-actions">
        <button type="button" className="flow-btn primary" onClick={() => setView(locked ? "plans" : "target")}>
          {locked ? "Upgrade to simulate" : "Open Simulate →"}
        </button>
        <button
          type="button"
          className={`spot-card-toggle${inFlow ? " in" : ""}`}
          aria-pressed={inFlow}
          onClick={() => (inFlow ? removeBlock("target") : addBlock("target"))}
          title={inFlow ? "Remove from your flow" : "Add to your flow"}
        >
          {inFlow ? "In your flow ✓" : "Add +"}
        </button>
      </div>
    </div>
  );
}

export function SpotlightView() {
  const resetFlow = useFlowStore((s) => s.resetFlow);
  const recommendedNext = useRecommendedNext();
  const gridBlocks = COMPOSABLE_BLOCKS.filter((v) => v !== "target");
  const setView = useViewStore((s) => s.setView);
  const cvName = useCVStore((s) => s.cv.basics.fullName);
  const started = useCVStore((s) => s.started);
  const currentName = cvName.trim();
  const activeTemplate = useCVStore((s) => s.activeTemplate);
  const templateName = getTemplateInfo(activeTemplate)?.name ?? "Aurora";
  const reducedMotion = useReducedMotion();
  const { data: session, status } = useSession();
  const firstName = session?.user?.name?.trim().split(/\s+/)[0];
  const greeting =
    status === "authenticated"
      ? firstName ? `Good to see you, ${firstName}.` : "Welcome back."
      : started
        ? "Welcome back — your draft is saved on this device."
        : "Welcome to Orire. Build your CV free; sign up only for AI or to export.";

  return (
    <motion.div
      className="ws-view spotlight-view"
      initial={reducedMotion ? false : { opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: reducedMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="ws-head">
        <div>
          <h2>Your CV studio</h2>
          <p>{greeting}</p>
        </div>
      </header>
      <div className="spot-studio-context" role="group" aria-label="Current CV context">
        <span>{started ? `Current CV: ${currentName || "Untitled CV"}` : "New CV"}</span>
        <span>Template: <strong>{templateName}</strong></span>
      </div>
      <section className="spot-studio-next" aria-label="Continue your CV">
        <div>
          <h3>{started ? "Continue your CV" : "Start your first CV"}</h3>
          <p>{started ? `Pick up where you left off${currentName ? ` — ${currentName}` : ""}. Your existing edits remain in your workspace.` : "Add your experience, choose a template and see the live preview as you work."}</p>
        </div>
        <div className="spot-studio-actions">
          <button type="button" className="flow-btn primary" onClick={() => setView("edit")}>{started ? "Continue editing →" : "Create your CV →"}</button>
          <button type="button" className="flow-btn" onClick={() => setView("history")}>Your library</button>
        </div>
      </section>

      <section className="spot-studio-tools" aria-labelledby="spot-studio-tools-title">
        <div className="spot-studio-tools-head">
          <h3 id="spot-studio-tools-title">Your CV tools</h3>
          <p>Open a tool or add it to your flow.</p>
        </div>
        <div className="spot-grid">
          {gridBlocks.map((v) => (
            <BlockCard key={v} view={v} recommended={v === recommendedNext} />
          ))}
        </div>
      </section>

      <SimulateHero />

      <div className="spot-foot">
        <button type="button" className="flow-btn ghost sm" onClick={resetFlow}>
          Reset to recommended flow
        </button>
      </div>
    </motion.div>
  );
}
