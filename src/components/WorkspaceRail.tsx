"use client";

import { motion } from "framer-motion";
import { useViewStore, type WorkspaceView } from "@/lib/store/viewStore";

interface RailItem {
  view: WorkspaceView;
  label: string;
  hint: string;
  icon: string;
}

const PRIMARY: RailItem[] = [
  { view: "edit", label: "Edit", hint: "Two-pane live editor", icon: "✎" },
  { view: "refine", label: "Refine", hint: "Connect AI · import · tailor to a job", icon: "✦" },
  { view: "simulate", label: "Simulate", hint: "Ideal 100%-match benchmark", icon: "◎" },
  { view: "rate", label: "Rate", hint: "Score initial → final", icon: "★" },
  { view: "progress", label: "Progress", hint: "What's shipped", icon: "▦" },
];

const FOOTER: RailItem[] = [
  { view: "connect", label: "Connect AI", hint: "Providers & API keys", icon: "⚙" },
];

function RailButton({ item }: { item: RailItem }) {
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
    </button>
  );
}

export function WorkspaceRail() {
  return (
    <nav className="rail" aria-label="Workspaces">
      <div className="rail-brand" aria-hidden>o.</div>
      <div className="rail-group">
        {PRIMARY.map((it) => (
          <RailButton key={it.view} item={it} />
        ))}
      </div>
      <div className="rail-group rail-foot">
        {FOOTER.map((it) => (
          <RailButton key={it.view} item={it} />
        ))}
      </div>
    </nav>
  );
}
