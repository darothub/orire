"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { VIEW_META } from "@/lib/store/viewMeta";
import { useHistoryStore, groupByCompany, PAGE_MODES } from "@/lib/store/historyStore";

const MODE_LABEL = Object.fromEntries(PAGE_MODES.map((m) => [m.id, m.label]));

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function HistoryView() {
  const entries = useHistoryStore((s) => s.entries);
  const remove = useHistoryStore((s) => s.remove);
  const clear = useHistoryStore((s) => s.clear);
  const loadCV = useCVStore((s) => s.loadCV);
  const setTemplate = useCVStore((s) => s.setTemplate);
  const setView = useViewStore((s) => s.setView);

  const groups = groupByCompany(entries);

  const reopen = (id: string) => {
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    loadCV(e.cv);
    setTemplate(e.template);
    setView("edit");
  };

  return (
    <motion.div
      className="ws-view history-view"
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ws-head">
        <div>
          <h2>{VIEW_META.history.label}</h2>
          <p>Every CV you export is filed here under the company you saved it for.</p>
        </div>
        {entries.length > 0 && (
          <button className="flow-btn ghost" onClick={clear}>Clear all</button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="hist-empty">
          <span className="hist-empty-ic" aria-hidden>🗂️</span>
          <p>No exports yet. When you export a CV, it’ll appear here grouped by company.</p>
        </div>
      ) : (
        <div className="hist-groups">
          {groups.map((g) => (
            <section key={g.company} className="hist-group">
              <div className="hist-company">
                <span className="hist-company-dot" aria-hidden />
                <h3>{g.company}</h3>
                <span className="hist-count">{g.items.length}</span>
              </div>
              <div className="hist-list">
                <AnimatePresence initial={false}>
                  {g.items.map((e) => (
                    <motion.div
                      key={e.id}
                      className="hist-card"
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className="hist-card-main">
                        <strong className="hist-name">{e.fileName}</strong>
                        <div className="hist-meta">
                          <span className="hist-tag">{e.templateName}</span>
                          <span className="hist-tag subtle">{MODE_LABEL[e.mode] ?? e.mode}</span>
                          {e.person && <span className="hist-person">{e.person}</span>}
                          <span className="hist-time">{timeAgo(e.createdAt)}</span>
                        </div>
                      </div>
                      <div className="hist-card-actions">
                        <button className="hist-btn" onClick={() => reopen(e.id)} title="Load this CV into the editor">Reopen</button>
                        <button className="hist-btn danger" onClick={() => remove(e.id)} title="Remove from history" aria-label="Delete">✕</button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      )}
    </motion.div>
  );
}
