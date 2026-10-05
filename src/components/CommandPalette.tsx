"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useViewStore, type WorkspaceView } from "@/lib/store/viewStore";
import { useCVStore } from "@/lib/store/cvStore";
import { useUIStore } from "@/lib/store/uiStore";
import { TEMPLATES } from "@/components/templates/registry";

interface Command {
  id: string;
  group: "Go to" | "Templates" | "Actions";
  title: string;
  hint?: string;
  icon: string;
  keywords?: string;
  swatch?: string;
  active?: boolean;
  run: () => void;
}

const VIEW_META: { view: WorkspaceView; label: string; hint: string; icon: string }[] = [
  { view: "edit", label: "Edit", hint: "Two-pane live editor", icon: "✎" },
  { view: "refine", label: "Refine", hint: "Connect AI · import · tailor to a job", icon: "✦" },
  { view: "target", label: "Target", hint: "Simulate the ideal match & edit toward it", icon: "🎯" },
  { view: "export", label: "Export", hint: "Style, page layout & PDF download", icon: "⭳" },
  { view: "history", label: "History", hint: "Exported CVs, filed by company", icon: "🗂" },
  { view: "rate", label: "Rate", hint: "Score initial → final", icon: "★" },
  { view: "connect", label: "Connect AI", hint: "Providers & API keys", icon: "⚙" },
];

/** ⌘K / Ctrl-K command palette: jump to any workspace, switch template, or fire
 *  a quick action. Fully keyboard-driven, framer-animated, no new deps. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const setView = useViewStore((s) => s.setView);
  const currentView = useViewStore((s) => s.view);
  const setTemplate = useCVStore((s) => s.setTemplate);
  const activeTemplate = useCVStore((s) => s.activeTemplate);
  const reset = useCVStore((s) => s.reset);
  const previewEdit = useUIStore((s) => s.previewEdit);
  const togglePreviewEdit = useUIStore((s) => s.togglePreviewEdit);

  // Global open/close shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset transient state whenever the palette opens. Sanctioned setState-in-
  // effect: it syncs UI to an external open/close signal, not derived data.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      setIdx(0);
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  const close = () => setOpen(false);
  const runAnd = (fn: () => void) => {
    fn();
    close();
  };

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = VIEW_META.map((v) => ({
      id: `go:${v.view}`,
      group: "Go to",
      title: v.label,
      hint: v.hint,
      icon: v.icon,
      keywords: `${v.label} ${v.hint} workspace view`,
      active: currentView === v.view,
      run: () => runAnd(() => setView(v.view)),
    }));

    const tpls: Command[] = TEMPLATES.map((t) => ({
      id: `tpl:${t.id}`,
      group: "Templates",
      title: t.name,
      hint: t.blurb,
      icon: "▦",
      swatch: t.swatch,
      keywords: `${t.name} ${t.blurb} template design theme`,
      active: activeTemplate === t.id,
      run: () => runAnd(() => setTemplate(t.id)),
    }));

    const actions: Command[] = [
      {
        id: "act:export",
        group: "Actions",
        title: "Download PDF",
        hint: "Open the export workspace",
        icon: "⭳",
        keywords: "export download pdf save",
        run: () => runAnd(() => setView("export")),
      },
      {
        id: "act:preview-edit",
        group: "Actions",
        title: previewEdit ? "Stop editing on preview" : "Edit on the preview",
        hint: "Toggle in-place editing on the CV",
        icon: "✍",
        keywords: "edit preview inline in place toggle",
        run: () => runAnd(togglePreviewEdit),
      },
      {
        id: "act:reset",
        group: "Actions",
        title: "Reset CV",
        hint: "Restore the sample document",
        icon: "↺",
        keywords: "reset clear restore sample new",
        run: () => runAnd(reset),
      },
    ];

    return [...nav, ...tpls, ...actions];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, activeTemplate, previewEdit]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    const terms = q.split(/\s+/);
    return commands.filter((c) => {
      const hay = `${c.title} ${c.hint ?? ""} ${c.keywords ?? ""}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [commands, query]);

  // Clamp at render time (deriving, not storing) so a shrinking list never
  // points past the end — avoids a setState-in-effect.
  const activeIdx = filtered.length ? Math.min(idx, filtered.length - 1) : 0;

  // Scroll the active row into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-i="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx(Math.min(activeIdx + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx(Math.max(activeIdx - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[activeIdx]?.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  // Render rows with group headers injected when the group changes.
  let lastGroup = "";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cmdk-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onMouseDown={close}
        >
          <motion.div
            className="cmdk-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -12, scale: 0.98, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, scale: 0.985, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cmdk-search">
              <span className="cmdk-search-ic" aria-hidden>⌕</span>
              <input
                ref={inputRef}
                className="cmdk-input"
                placeholder="Search workspaces, templates, actions…"
                value={query}
                spellCheck={false}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIdx(0);
                }}
                onKeyDown={onInputKey}
              />
              <kbd className="cmdk-esc">esc</kbd>
            </div>

            <div className="cmdk-list" ref={listRef}>
              {filtered.length === 0 && (
                <div className="cmdk-empty">No matches for “{query}”.</div>
              )}
              {filtered.map((c, i) => {
                const header = c.group !== lastGroup ? c.group : null;
                lastGroup = c.group;
                return (
                  <div key={c.id}>
                    {header && <div className="cmdk-group">{header}</div>}
                    <button
                      type="button"
                      data-i={i}
                      className={`cmdk-row${i === activeIdx ? " is-active" : ""}${c.active ? " is-current" : ""}`}
                      onMouseMove={() => setIdx(i)}
                      onClick={c.run}
                    >
                      <span
                        className="cmdk-ic"
                        aria-hidden
                        style={c.swatch ? { background: c.swatch, color: "transparent" } : undefined}
                      >
                        {c.swatch ? "" : c.icon}
                      </span>
                      <span className="cmdk-text">
                        <span className="cmdk-title">{c.title}</span>
                        {c.hint && <span className="cmdk-hint">{c.hint}</span>}
                      </span>
                      {c.active && <span className="cmdk-current">current</span>}
                      {i === activeIdx && !c.active && <span className="cmdk-enter" aria-hidden>↵</span>}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="cmdk-foot">
              <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
              <span><kbd>↵</kbd> select</span>
              <span><kbd>esc</kbd> close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
