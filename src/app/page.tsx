"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { SectionOrder } from "@/components/editor/SectionOrder";
import { TemplatePicker } from "@/components/templates/TemplatePicker";
import { getTemplate } from "@/components/templates/registry";
import { useCVStore } from "@/lib/store/cvStore";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cv = useCVStore((s) => s.cv);
  const active = useCVStore((s) => s.activeTemplate);
  const reset = useCVStore((s) => s.reset);

  const tpl = getTemplate(active);
  const ActiveTemplate = tpl.Component;

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
          <button className="btn-ghost" onClick={reset}>Reset</button>
          <button className="btn-primary" onClick={() => window.print()}>Export PDF</button>
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
    </div>
  );
}
