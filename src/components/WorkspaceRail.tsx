"use client";

import { workspaceBusy } from "@/lib/store/busy";
import { useEffect, useState } from "react";
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

// Mirrors globals.css's `@media (max-width: 820px)` rail breakpoint, where
// `.rail-group`/`.rail-ritem` switch from a vertical column to a horizontal
// row. Framer Motion's drag physics don't know about CSS, so the rail's
// `Reorder.Group axis` has to be tracked in JS and kept in sync with this
// same breakpoint — otherwise pointer-drag stays locked to the vertical axis
// on a horizontally-laid-out strip and reordering by touch doesn't track the
// visual order.
const RAIL_NARROW_QUERY = "(max-width: 820px)";

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

  const busy = workspaceBusy({
    active,
    judgePhase,
    refineColPhases: runProviders.map((p) => cols[p]?.phase ?? "idle"),
  });

  const badgeFor = (v: WorkspaceView): Badge => {
    if (v === "refine") return busy.refine ? "busy" : null;
    if (v === "target") return busy.simulate ? "busy" : null;
    return null;
  };

  const sequence = useFlowStore((s) => s.sequence);
  const setSequence = useFlowStore((s) => s.setSequence);
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);

  // Pointer drag (Reorder.Group) has no keyboard equivalent, so every block also
  // gets explicit move-earlier/move-later buttons — the WAI-ARIA-recommended
  // fallback for a reorderable list, and the only way a keyboard or switch user
  // can rearrange the rail at all. "earlier/later" rather than "up/down" because
  // the rail lays out horizontally on narrow screens.
  const [announcement, setAnnouncement] = useState("");

  // Starts "y" (desktop default) and flips to "x" once we know the viewport
  // is narrow — avoids a hydration mismatch, and matches on resize so
  // rotating a tablet or resizing a window doesn't leave drag on the wrong
  // axis mid-session.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(RAIL_NARROW_QUERY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs to a client-only media-query signal, not derived data
    setNarrow(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const moveBlock = (v: WorkspaceView, dir: -1 | 1) => {
    const idx = sequence.indexOf(v);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= sequence.length) return;
    const next = [...sequence];
    [next[idx], next[to]] = [next[to], next[idx]];
    setSequence(next);
    setAnnouncement(`${VIEW_META[v].label} moved to position ${to + 1} of ${next.length}.`);
  };

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
      {/* Screen-reader-only live region announcing keyboard reorders. */}
      <div className="sr-only" aria-live="polite">{announcement}</div>
      {/* The flow sequence — drag to reorder (A2), or use the move buttons below
          each block (keyboard/AT fallback). */}
      <Reorder.Group axis={narrow ? "x" : "y"} values={sequence} onReorder={setSequence} className="rail-group" as="div" role="list">
        {sequence.map((v, i) => (
          <Reorder.Item key={v} value={v} as="div" className="rail-ritem" role="listitem" aria-roledescription="reorderable block">
            <RailButton item={v} badge={badgeFor(v)} />
            <div className="rail-move">
              <button
                type="button"
                className="rail-move-btn"
                onClick={() => moveBlock(v, -1)}
                disabled={i === 0}
                aria-label={`Move ${VIEW_META[v].label} earlier`}
                title="Move earlier"
              >
                ▲
              </button>
              <button
                type="button"
                className="rail-move-btn"
                onClick={() => moveBlock(v, 1)}
                disabled={i === sequence.length - 1}
                aria-label={`Move ${VIEW_META[v].label} later`}
                title="Move later"
              >
                ▼
              </button>
            </div>
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
