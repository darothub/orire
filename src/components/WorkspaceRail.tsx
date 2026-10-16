"use client";

import { motion, Reorder } from "framer-motion";
import { useViewStore, type WorkspaceView } from "@/lib/store/viewStore";
import { VIEW_META } from "@/lib/store/viewMeta";
import { useRefineStore } from "@/lib/store/refineStore";
import { useUsageStore } from "@/lib/store/usageStore";
import { useFlowStore, PINNED_VIEWS } from "@/lib/store/flowStore";
import type { Metric } from "@/lib/plan/plan";
import { BrandMark } from "@/components/BrandMark";
import { Tooltip } from "@/components/ui/Tooltip";
import { useRunStore } from "@/lib/store/runStore";

type Badge = "warn" | "busy" | null;

// Rail items backed by a metered action — greyed out when its free cap is spent.
const METRIC_FOR_VIEW: Partial<Record<WorkspaceView, Metric>> = {
  refine: "refine",
  target: "simulate",
  export: "download",
};

function RailButton({ item, badge }: { item: WorkspaceView; badge?: Badge }) {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const metric = METRIC_FOR_VIEW[item];
  const locked = useUsageStore((s) => (metric ? s.exhausted(metric) : false));
  const meta = VIEW_META[item];
  const active = view === item;
  const hint = locked ? "Free limit reached — upgrade to Pro to keep using this." : meta.hint;
  return (
    <Tooltip title={meta.label} hint={hint} placement="right">
      <button
        className={`rail-item ${active ? "is-active" : ""} ${locked ? "is-locked" : ""}`}
        data-tour={`rail-${item}`}
        // When locked, the click routes to Plans (the upgrade path) rather than
        // the spent feature.
        onClick={() => setView(locked ? "plans" : item)}
        aria-label={locked ? `${meta.label} — free limit reached, upgrade to continue` : meta.label}
        aria-current={active ? "page" : undefined}
      >
        {active && (
          <motion.span
            layoutId="rail-active"
            className="rail-active"
            transition={{ type: "spring", stiffness: 500, damping: 38 }}
          />
        )}
        <span className="rail-icon" aria-hidden>{meta.icon}</span>
        <span className="rail-label">{meta.label}</span>
        {locked && <span className="rail-lock" aria-hidden>🔒</span>}
        {badge && !locked && <span className={`rail-badge ${badge}`} aria-hidden />}
      </button>
    </Tooltip>
  );
}

export function WorkspaceRail() {
  const cols = useRefineStore((s) => s.cols);
  const judgePhase = useRefineStore((s) => s.judgePhase);
  const runProviders = useRefineStore((s) => s.runProviders);
  const active = useRunStore((s) => s.active);

  const simBusy = Boolean(active["simulate"]);
  const refineBusy =
    judgePhase === "running" ||
    Boolean(active["judge"]) ||
    simBusy ||
    runProviders.some((p) => cols[p]?.phase === "running");

  const badgeFor = (v: WorkspaceView): Badge => {
    if (v === "refine") return refineBusy ? "busy" : null;
    if (v === "target") return simBusy || active["retone"] ? "busy" : null;
    return null;
  };

  const sequence = useFlowStore((s) => s.sequence);
  const setSequence = useFlowStore((s) => s.setSequence);
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);

  return (
    <nav className="rail" aria-label="Workspaces">
      <button
        className={`rail-brand rail-home${view === "spotlight" ? " is-active" : ""}`}
        data-tour="rail-home"
        onClick={() => setView("spotlight")}
        title="Home — your building blocks"
        aria-label="Home"
        aria-current={view === "spotlight" ? "page" : undefined}
      >
        <BrandMark size={26} />
      </button>
      {/* The flow sequence — drag to reorder (A2). */}
      <Reorder.Group axis="y" values={sequence} onReorder={setSequence} className="rail-group" as="div">
        {sequence.map((v) => (
          <Reorder.Item key={v} value={v} as="div" className="rail-ritem">
            <RailButton item={v} badge={badgeFor(v)} />
          </Reorder.Item>
        ))}
      </Reorder.Group>
      <div className="rail-group">
        <Tooltip title="Add blocks" hint="Open your studio to add or remove blocks" placement="right">
          <button className="rail-item rail-add" onClick={() => setView("spotlight")} aria-label="Add blocks">
            <span className="rail-icon" aria-hidden>＋</span>
            <span className="rail-label">Add</span>
          </button>
        </Tooltip>
      </div>
      <div className="rail-group rail-foot">
        {PINNED_VIEWS.map((v) => (
          <RailButton key={v} item={v} badge={badgeFor(v)} />
        ))}
      </div>
    </nav>
  );
}
