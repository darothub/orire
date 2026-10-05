"use client";

import { motion } from "framer-motion";
import { useViewStore, type WorkspaceView } from "@/lib/store/viewStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useRefineStore } from "@/lib/store/refineStore";
import { useRunStore } from "@/lib/store/runStore";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";

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
];

const FOOTER: RailItem[] = [
  { view: "connect", label: "Connect AI", hint: "Providers & API keys", icon: "⚙" },
];

function RailButton({ item, badge }: { item: RailItem; badge?: Badge }) {
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const active = view === item.view;
  return (
    <button
      className={`rail-item ${active ? "is-active" : ""}`}
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
  const keys = useSettingsStore((s) => s.keys);
  const cols = useRefineStore((s) => s.cols);
  const judgePhase = useRefineStore((s) => s.judgePhase);
  const runProviders = useRefineStore((s) => s.runProviders);
  const active = useRunStore((s) => s.active);

  const noKeys = !PROVIDER_IDS.some((p) => keys[p]?.trim());
  const simBusy = Boolean(active["simulate"]);
  const refineBusy =
    judgePhase === "running" ||
    Boolean(active["judge"]) ||
    simBusy ||
    runProviders.some((p) => cols[p]?.phase === "running");

  const badgeFor = (v: WorkspaceView): Badge => {
    if (v === "connect") return noKeys ? "warn" : null;
    if (v === "refine") return refineBusy ? "busy" : null;
    if (v === "target") return simBusy || active["retone"] ? "busy" : null;
    return null;
  };

  return (
    <nav className="rail" aria-label="Workspaces">
      <div className="rail-brand" aria-hidden>o.</div>
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

const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];
