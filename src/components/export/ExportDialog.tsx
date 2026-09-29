"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { useHistoryStore, PAGE_MODES, type PageMode } from "@/lib/store/historyStore";
import { getTemplate } from "@/components/templates/registry";
import { printCV } from "@/lib/export/print";

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cv = useCVStore((s) => s.cv);
  const active = useCVStore((s) => s.activeTemplate);
  const add = useHistoryStore((s) => s.add);
  const lastCompany = useHistoryStore((s) => s.lastCompany);

  const person = cv.basics.fullName.trim();
  const tpl = getTemplate(active);

  const defaultName = useMemo(() => (person ? `${person} — CV` : "orire — CV"), [person]);
  const [fileName, setFileName] = useState(defaultName);
  const [company, setCompany] = useState(lastCompany);
  const [mode, setMode] = useState<PageMode>("paged");
  const [warn, setWarn] = useState<string | null>(null);

  // Re-seed the fields whenever the dialog is (re)opened.
  const [seededFor, setSeededFor] = useState(false);
  if (open && !seededFor) {
    setFileName(defaultName);
    setCompany(lastCompany);
    setWarn(null);
    setSeededFor(true);
  }
  if (!open && seededFor) setSeededFor(false);

  const doExport = () => {
    const ok = printCV(mode, fileName);
    if (!ok) {
      setWarn("The live CV isn't visible right now — leave compare mode, then export.");
      return;
    }
    add({
      fileName: fileName.trim() || defaultName,
      company: company.trim(),
      person,
      template: active,
      templateName: tpl.name,
      mode,
      cv,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="exp-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className="exp-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Export CV"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="exp-head">
              <h3>Export CV</h3>
              <button className="exp-x" onClick={onClose} aria-label="Close">✕</button>
            </div>

            <label className="exp-field">
              <span className="exp-label">Save as</span>
              <input
                className="ed-input"
                value={fileName}
                spellCheck={false}
                autoFocus
                onChange={(e) => setFileName(e.target.value)}
                placeholder={defaultName}
              />
              <span className="exp-sub">Your browser adds “.pdf” in the save dialog.</span>
            </label>

            <label className="exp-field">
              <span className="exp-label">Company <span className="exp-opt">· for History</span></span>
              <input
                className="ed-input"
                value={company}
                spellCheck={false}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Acme Corp"
              />
              <span className="exp-sub">Exports are filed under the company in History.</span>
            </label>

            <div className="exp-field">
              <span className="exp-label">Page size</span>
              <div className="exp-modes">
                {PAGE_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`exp-mode${mode === m.id ? " is-on" : ""}`}
                    onClick={() => setMode(m.id)}
                    aria-pressed={mode === m.id}
                  >
                    <span className="exp-mode-ic" aria-hidden>
                      {m.id === "continuous" ? "▤" : m.id === "paged" ? "▦" : "▢"}
                    </span>
                    <span className="exp-mode-txt">
                      <strong>{m.label}</strong>
                      <em>{m.hint}</em>
                    </span>
                    {mode === m.id && (
                      <motion.span layoutId="exp-mode-ring" className="exp-mode-ring" transition={{ type: "spring", stiffness: 480, damping: 34 }} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {warn && <p className="exp-warn">{warn}</p>}

            <div className="exp-actions">
              <button className="flow-btn ghost" onClick={onClose}>Cancel</button>
              <button className="flow-btn primary" onClick={doExport}>Export PDF</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
