"use client";

import { motion } from "framer-motion";
import { useViewStore, type WorkspaceView } from "@/lib/store/viewStore";
import { useRefineStore } from "@/lib/store/refineStore";
import { BrandMark } from "@/components/BrandMark";
import { useRunStore } from "@/lib/store/runStore";

type Badge = "warn" | "busy" | null;

interface RailItem {
  view: WorkspaceView;
  label: string;
  hint: string;
  icon: string;
}

const PRIMARY: RailItem[] = [
  { view: "edit", label: "Edit", hint: "Two-pane live editor", icon: "✎" },
  { view: "rebrand", label: "Re-brand", hint: "Restructure a CV into a new template", icon: "⟳" },
  { view: "refine", label: "Refine", hint: "Connect AI · import · tailor to a job", icon: "✦" },
  { view: "target", label: "Target", hint: "Simulate the ideal match & edit toward it", icon: "🎯" },
  { view: "cover", label: "Cover", hint: "Write, edit & export a cover letter", icon: "✉" },
  { view: "export", label: "Export", hint: "Style, page layout & PDF download", icon: "⭳" },
  { view: "history", label: "History", hint: "Exported CVs, filed by company", icon: "🗂" },
  { view: "rate", label: "Rate", hint: "Score initial → final", icon: "★" },
  { view: "plans", label: "Plans", hint: "Pricing & what each plan unlocks", icon: "◆" },
];

const FOOTER: RailItem[] = [
  { view: "profile", label: "Profile", hint: "Your activity, rating & plan", icon: "☻" },
  { view: "connect", label: "Connect AI", hint: "Assistants", icon: "⚙" },
];

function RailButton({ item, badge }: { item: RailItem; badge?: Badge }) {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const active = view === item.view;
  return (
    <button
      className={`rail-item ${active ? "is-active" : ""}`}
      data-tour={`rail-${item.view}`}
      onClick={() => setView(item.view)}
      title={`${item.label} — ${item.hint}`}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
    >
      {active && (
        <motion.span
          layoutId="rail-active"
          className="rail-active"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
      <span className="rail-icon" aria-hidden>{item.icon}</span>
      <span className="rail-label">{item.label}</span>
      {badge && <span className={`rail-badge ${badge}`} aria-hidden />}
    </button>
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
        {PRIMARY.map((it) => (
          <RailButton key={it.view} item={it} badge={badgeFor(it.view)} />
        ))}
      </div>
      <div className="rail-group rail-foot">
        {FOOTER.map((it) => (
          <RailButton key={it.view} item={it} badge={badgeFor(it.view)} />
        ))}
      </div>
    </nav>
  );
}
