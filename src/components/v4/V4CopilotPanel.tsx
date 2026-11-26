"use client";

import { useState } from "react";
import Link from "next/link";
import { useUsageStore } from "@/lib/store/usageStore";
import { useCollapsed } from "@/lib/v4/useCollapsed";
import { ASK_SHORTCUTS, chatMeta, type AskShortcut } from "@/lib/v4/copilot";

export interface PanelChat { id: string; title: string; saved: boolean }

interface Props {
  chats: PanelChat[];
  activeId: string;
  /** A run is in flight: switching, starting or deleting chats is locked. */
  busy: boolean;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onAsk: (shortcut: AskShortcut) => void;
  /** Chat is Career only: other plans see a lock on the actions and an upgrade link. */
  locked: boolean;
  onSave: () => void;
  saveLabel: string;
  canSave: boolean;
  /** Mobile: close the drawer after a choice. */
  onChoose: () => void;
}

const I = {
  plus: "M12 5v14M5 12h14",
  history: "M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5M12 7v5l3 2",
  lock: "M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z",
  left: "M15 6l-6 6 6 6",
  right: "M9 6l6 6-6 6",
};
const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d={d} /></svg>;

/** The Copilot's left panel: new chat, quick actions, chats and the coach-run meter. */
export function V4CopilotPanel({ chats, activeId, busy, onNew, onOpen, onDelete, onAsk, locked, onSave, saveLabel, canSave, onChoose }: Props) {
  const [collapsed, toggleCollapsed] = useCollapsed("copilot-panel");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const coach = useUsageStore((s) => s.summary?.metrics.coach);
  const left = coach && coach.cap !== null ? Math.max(0, coach.cap - coach.used) : null;
  const cap = coach?.cap ?? null;

  return (
    <nav className={`v4-cop-panel${collapsed ? " v4-cop-panel--collapsed" : ""}`} aria-label="Copilot">
      <button type="button" className="v4-cop-new" disabled={busy} onClick={() => { onNew(); onChoose(); }} aria-label="New chat" title="New chat">
        <Icon d={I.plus} /><span className="v4-cop-label">New chat</span>
      </button>

      <div className="v4-cop-group">
        <div className="v4-cop-head v4-cop-label">Ask Copilot to</div>
        {ASK_SHORTCUTS.map((a) => (
          <button key={a.intent} type="button" className="v4-cop-item" disabled={busy} title={a.hint} aria-label={a.label} onClick={() => { onAsk(a); onChoose(); }}>
            <Icon d={a.icon} /><span className="v4-cop-label">{a.label}</span>
            {locked && <span className="v4-cop-lock"><Icon d={I.lock} /></span>}
          </button>
        ))}
        {locked && (
          <Link href="/pricing" className="v4-cop-upgrade"><span className="v4-cop-label">Upgrade to Career</span></Link>
        )}
      </div>

      <div className="v4-cop-group v4-cop-chats">
        <div className="v4-cop-head v4-cop-label">Chats</div>
        {collapsed ? (
          <button type="button" className="v4-cop-item" aria-label={`Chats (${chats.length})`} title={`Chats (${chats.length})`} onClick={toggleCollapsed}>
            <Icon d={I.history} /><b className="v4-cop-count">{chats.length}</b>
          </button>
        ) : (
          <ul className="v4-cop-list">
            {chats.map((c) => (
              <li key={c.id} className={c.id === activeId ? "on" : ""}>
                <button type="button" className="v4-cop-chat" aria-current={c.id === activeId} disabled={busy} onClick={() => { onOpen(c.id); onChoose(); }}>
                  <b>{c.title}</b>
                  <span>{chatMeta(c.saved)}</span>
                </button>
                {confirmDel === c.id ? (
                  <span className="v4-cop-confirm">
                    <button type="button" className="or-btn danger" onClick={() => { setConfirmDel(null); onDelete(c.id); }}>Delete</button>
                    <button type="button" className="v4-iconbtn" aria-label="Keep chat" onClick={() => setConfirmDel(null)}>✕</button>
                  </span>
                ) : (
                  <button type="button" className="v4-iconbtn v4-cop-del" disabled={busy} aria-label={`Delete ${c.title}`} onClick={() => setConfirmDel(c.id)}>✕</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {!collapsed && (
          <button type="button" className="or-btn v4-cop-save" disabled={!canSave} onClick={onSave}>{saveLabel}</button>
        )}
      </div>

      {cap !== null && left !== null && (
        <div className="v4-cop-meter" title={`${left} of ${cap} coach runs left`}>
          {collapsed ? (
            <span className="v4-cop-ring" style={{ ["--pct" as string]: `${Math.round((left / cap) * 100)}%` }}><span>{left}</span></span>
          ) : (
            <>
              <div className="v4-usage-row"><b>Coach runs</b><span>{left} of {cap} left</span></div>
              <div className="v4-meter"><span style={{ width: `${Math.round(((cap - left) / cap) * 100)}%` }} /></div>
              <span className="v4-hint">Shared with the bullet coach.</span>
            </>
          )}
        </div>
      )}

      <button type="button" className="v4-subcollapse v4-cop-collapse" onClick={toggleCollapsed} aria-expanded={!collapsed} aria-label={collapsed ? "Expand Copilot panel" : "Collapse Copilot panel"} title={collapsed ? "Expand" : "Collapse"}>
        <Icon d={collapsed ? I.right : I.left} /><span className="v4-cop-label">Collapse</span>
      </button>
    </nav>
  );
}
