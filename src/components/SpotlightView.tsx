"use client";

import { motion } from "framer-motion";
import { useViewStore, type WorkspaceView } from "@/lib/store/viewStore";
import { VIEW_META } from "@/lib/store/viewMeta";
import { useFlowStore, COMPOSABLE_BLOCKS } from "@/lib/store/flowStore";
import { useUsageStore } from "@/lib/store/usageStore";
import type { Metric } from "@/lib/plan/plan";

/** Metered blocks that grey out / route to Plans once the free cap is spent. */
const METRIC_FOR_VIEW: Partial<Record<WorkspaceView, Metric>> = {
  refine: "refine",
  target: "simulate",
  export: "download",
};

function BlockCard({ view }: { view: WorkspaceView }) {
  const meta = VIEW_META[view];
  const setView = useViewStore((s) => s.setView);
  const inFlow = useFlowStore((s) => s.sequence.includes(view));
  const addBlock = useFlowStore((s) => s.addBlock);
  const removeBlock = useFlowStore((s) => s.removeBlock);
  const metric = METRIC_FOR_VIEW[view];
  const locked = useUsageStore((s) => (metric ? s.exhausted(metric) : false));

  return (
    <div className={`spot-card${locked ? " is-locked" : ""}`}>
      <button
        type="button"
        className="spot-card-open"
        onClick={() => setView(locked ? "plans" : view)}
        aria-label={locked ? `${meta.label} — free limit reached, upgrade to continue` : `Open ${meta.label}`}
      >
        <span className="spot-card-icon" aria-hidden>{meta.icon}</span>
        <span className="spot-card-text">
          <span className="spot-card-label">
            {meta.label}
            {locked && <span className="spot-card-lock" aria-hidden> 🔒</span>}
          </span>
          <span className="spot-card-hint">{locked ? "Free limit reached — upgrade to Pro." : meta.hint}</span>
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

export function SpotlightView() {
  const resetFlow = useFlowStore((s) => s.resetFlow);
  const coachSeen = useFlowStore((s) => s.coachSeen);
  const dismissCoach = useFlowStore((s) => s.dismissCoach);

  return (
    <motion.div
      className="ws-view spotlight-view"
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ws-head">
        <div>
          <h2>Your CV studio</h2>
          <p>
            Each tool is a building block. Add the ones you want to your flow — they line up in the
            left panel in the order you&apos;ll use them. Click any block to open it.
          </p>
        </div>
      </div>

      {!coachSeen && (
        <div className="spot-coach" role="note">
          <span className="spot-coach-text">
            <strong>Make it yours.</strong> The left panel is your flow — drag blocks to reorder
            them, and use the cards below (or the <b>＋</b> button) to add or remove blocks.
          </span>
          <button type="button" className="flow-btn sm" onClick={dismissCoach}>Got it</button>
        </div>
      )}

      <div className="spot-grid">
        {COMPOSABLE_BLOCKS.map((v) => (
          <BlockCard key={v} view={v} />
        ))}
      </div>

      <div className="spot-foot">
        <button type="button" className="flow-btn ghost sm" onClick={resetFlow}>
          Reset to recommended flow
        </button>
      </div>
    </motion.div>
  );
}
