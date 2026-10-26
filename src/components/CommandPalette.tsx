"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useViewStore, type WorkspaceView } from "@/lib/store/viewStore";
import { VIEW_META } from "@/lib/store/viewMeta";
import { useCVStore } from "@/lib/store/cvStore";
import { useUIStore } from "@/lib/store/uiStore";
import { useOnboardingStore } from "@/lib/store/onboardingStore";
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

// Which workspaces the palette's "Go to" group lists, and in what order.
// Labels/hints/icons come from VIEW_META (the single source of truth).
const NAV_VIEWS: WorkspaceView[] = ["edit", "refine", "target", "export", "history", "rate", "connect"];

/** ⌘K / Ctrl-K command palette: jump to any workspace, switch template, or fire
 *  a quick action. Fully keyboard-driven, framer-animated, no new deps. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const setView = useViewStore((s) => s.setView);
  const currentView = useViewStore((s) => s.view);
  const setTemplate = useCVStore((s) => s.setTemplate);
  const activeTemplate = useCVStore((s) => s.activeTemplate);
  const reset = useCVStore((s) => s.reset);
  const previewEdit = useUIStore((s) => s.previewEdit);
  const togglePreviewEdit = useUIStore((s) => s.togglePreviewEdit);
  const startTour = useOnboardingStore((s) => s.start);

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
      // Focus when the actual input mounts, rather than guessing when the
      // animated palette will be ready using a 20ms timeout.
      // The ref callback focuses on first mount; subsequent opens can reuse
      // the mounted element while AnimatePresence is exiting. Restore focus
      // after React commits the open state, without an arbitrary timeout.
      const frame = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(frame);
    }
  }, [open]);

  // Keep the palette in its existing styled location while isolating siblings
  // at every ancestor level. Making the whole workspace inert would also hide
  // this dialog, which is rendered inside it.
  useEffect(() => {
    if (!open) return;
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) return;
    const opener = document.activeElement;
    const isolated: HTMLElement[] = [];
    overlay.inert = false;
    let ancestor: HTMLElement = overlay;
    while (ancestor.parentElement) {
      for (const sibling of ancestor.parentElement.children) {
        if (sibling instanceof HTMLElement && sibling !== ancestor && !sibling.inert) {
          sibling.inert = true;
          isolated.push(sibling);
        }
      }
      if (ancestor.parentElement === document.body) break;
      ancestor = ancestor.parentElement;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      // Query on every keypress: searching can remove all command buttons.
      const controls = Array.from(panel.querySelectorAll<HTMLElement>(
        'input:not([disabled]), button:not([disabled]), [tabindex="0"]',
      )).filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) return;
      const focused = document.activeElement;
      if (!panel.contains(focused) || (event.shiftKey ? focused === first : focused === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      // AnimatePresence retains the closing palette briefly; its departing
      // controls must not remain keyboard stops after the background unlocks.
      overlay.inert = true;
      for (const element of isolated) element.inert = false;
      // A command can launch the tour. Let that dialog own initial focus;
      // its existing cleanup restores the persistent palette trigger later.
      if (useOnboardingStore.getState().active) return;
      if (opener instanceof HTMLElement && opener.isConnected && !opener.closest("[inert]")) {
        opener.focus({ preventScroll: true });
      } else {
        document.querySelector<HTMLElement>(".cmdk-hint-btn")?.focus({ preventScroll: true });
      }
    };
  }, [open]);

  const close = () => setOpen(false);
  const runAnd = (fn: () => void) => {
    fn();
    close();
  };

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = NAV_VIEWS.map((v) => {
      const meta = VIEW_META[v];
      return {
        id: `go:${v}`,
        group: "Go to",
        title: meta.label,
        hint: meta.hint,
        icon: meta.icon,
        keywords: `${meta.label} ${meta.hint} workspace view`,
        active: currentView === v,
        run: () => runAnd(() => setView(v)),
      };
    });

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
      {
        id: "act:tour",
        group: "Actions",
        title: "Take the tour",
        hint: "Replay the guided walkthrough",
        icon: "🧭",
        keywords: "tour onboarding guide walkthrough help intro getting started",
        run: () => runAnd(startTour),
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
          ref={overlayRef}
          className="cmdk-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onMouseDown={close}
        >
          <motion.div
            ref={panelRef}
            className="cmdk-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            aria-keyshortcuts="Control+K Meta+K"
            initial={{ opacity: 0, y: -12, scale: 0.98, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, scale: 0.985, filter: "blur(4px)" }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cmdk-search">
              <span className="cmdk-search-ic" aria-hidden>⌕</span>
              <input
                ref={(node) => {
                  inputRef.current = node;
                  if (node && open) node.focus({ preventScroll: true });
                }}
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
