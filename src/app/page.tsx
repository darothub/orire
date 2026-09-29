"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { SectionOrder } from "@/components/editor/SectionOrder";
import { TemplatePicker } from "@/components/templates/TemplatePicker";
import { ImportPanel } from "@/components/ingest/ImportPanel";
import { SettingsModal } from "@/components/ai/SettingsModal";
import { RefinePanel } from "@/components/ai/RefinePanel";
import { ComparePanel } from "@/components/ai/ComparePanel";
import { RatingPanel } from "@/components/ai/RatingPanel";
import { SimulatePanel } from "@/components/ai/SimulatePanel";
import { getTemplate } from "@/components/templates/registry";
import { useCVStore } from "@/lib/store/cvStore";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [importing, setImporting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [refining, setRefining] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [rating, setRating] = useState(false);
  const [simulating, setSimulating] = useState(false);
  useEffect(() => setMounted(true), []);

  const cv = useCVStore((s) => s.cv);
  const active = useCVStore((s) => s.activeTemplate);
  const reset = useCVStore((s) => s.reset);

  const tpl = getTemplate(active);
  const ActiveTemplate = tpl.Component;

  /** Print to PDF with a meaningful default filename (browsers use document.title). */
  function exportPDF() {
    const prev = document.title;
    const name = cv.basics.fullName.trim();
    document.title = name ? `${name} — CV` : "orire — CV";
    const restore = () => {
      document.title = prev;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
    // Safari may not fire afterprint reliably; restore defensively.
    window.setTimeout(restore, 1000);
  }

  return (
    <div className="app">
      <header className="app-bar">
        <div className="brand">
          <span className="brand-dot" />
          <span className="brand-name">orire</span>
          <span className="brand-tag">CV studio</span>
        </div>
        <div className="app-actions">
          <span className="template-pill">{mounted ? tpl.name : "—"}</span>
          <button className="btn-ghost" onClick={() => setRefining(true)}>Refine to JD</button>
          <button className="btn-ghost" onClick={() => setComparing(true)}>Compare</button>
          <button className="btn-ghost" onClick={() => setRating(true)}>Rate</button>
          <button className="btn-ghost" onClick={() => setSimulating(true)}>Simulate</button>
          <button className="btn-ghost" onClick={() => setImporting(true)}>Import CV</button>
          <button className="btn-ghost" onClick={() => setSettingsOpen(true)}>Settings</button>
          <button className="btn-ghost" onClick={reset}>Reset</button>
          <button className="btn-primary" onClick={exportPDF}>Export PDF</button>
        </div>
      </header>

      <main className="workspace">
        <motion.section
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="pane pane-edit"
          aria-label="Editor"
        >
          <div className="pane-head">
            <h2>Edit</h2>
            <p>Changes appear live on the right.</p>
          </div>
          {mounted ? (
            <>
              <SectionOrder />
              <EditorPanel />
            </>
          ) : (
            <div className="pane-skeleton" />
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
          className="pane pane-preview"
          aria-label="Live preview"
        >
          {mounted && <TemplatePicker />}
          <div className="preview-stage">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 14, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.99 }}
                transition={{ duration: 0.32, ease: "easeOut" }}
                className="paper"
                id="cv-paper"
              >
                {mounted && <ActiveTemplate cv={cv} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.section>
      </main>

      <AnimatePresence>
        {importing && <ImportPanel onClose={() => setImporting(false)} />}
        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
        {refining && (
          <RefinePanel
            onClose={() => setRefining(false)}
            onOpenSettings={() => {
              setRefining(false);
              setSettingsOpen(true);
            }}
          />
        )}
        {comparing && (
          <ComparePanel
            onClose={() => setComparing(false)}
            onOpenSettings={() => {
              setComparing(false);
              setSettingsOpen(true);
            }}
          />
        )}
        {rating && <RatingPanel onClose={() => setRating(false)} />}
        {simulating && (
          <SimulatePanel
            onClose={() => setSimulating(false)}
            onOpenSettings={() => {
              setSimulating(false);
              setSettingsOpen(true);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
