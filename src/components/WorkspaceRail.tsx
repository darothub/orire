"use client";

import { motion } from "framer-motion";
import { useViewStore, type WorkspaceView } from "@/lib/store/viewStore";
import { VIEW_META } from "@/lib/store/viewMeta";
import { useRefineStore } from "@/lib/store/refineStore";
import { BrandMark } from "@/components/BrandMark";
import { Tooltip } from "@/components/ui/Tooltip";
import { useRunStore } from "@/lib/store/runStore";

type Badge = "warn" | "busy" | null;

// Which workspaces the rail shows and in what order. Labels/hints/icons come
// from VIEW_META (the single source of truth) — this list owns only ordering
// and the primary/footer grouping.
const PRIMARY: WorkspaceView[] = ["edit", "rebrand", "refine", "target", "cover", "export", "history", "rate", "plans"];
const FOOTER: WorkspaceView[] = ["profile", "connect"];

function RailButton({ item, badge }: { item: WorkspaceView; badge?: Badge }) {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const meta = VIEW_META[item];
  const active = view === item;
  return (
    <Tooltip title={meta.label} hint={meta.hint} placement="right">
      <button
        className={`rail-item ${active ? "is-active" : ""}`}
        data-tour={`rail-${item}`}
        onClick={() => setView(item)}
        aria-label={meta.label}
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
        {badge && <span className={`rail-badge ${badge}`} aria-hidden />}
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

  return (
    <nav className="rail" aria-label="Workspaces">
      <div className="rail-brand" aria-hidden><BrandMark size={26} /></div>
      <div className="rail-group">
        {PRIMARY.map((v) => (
          <RailButton key={v} item={v} badge={badgeFor(v)} />
        ))}
      </div>
      <div className="rail-group rail-foot">
        {FOOTER.map((v) => (
          <RailButton key={v} item={v} badge={badgeFor(v)} />
        ))}
      </div>
    </nav>
  );
}
