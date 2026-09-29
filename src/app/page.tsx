"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { AuroraTemplate } from "@/components/templates/AuroraTemplate";
import { useCVStore } from "@/lib/store/cvStore";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cv = useCVStore((s) => s.cv);
  const reset = useCVStore((s) => s.reset);

  return (
    <div className="app">
      <header className="app-bar">
        <div className="brand">
          <span className="brand-dot" />
          <span className="brand-name">orire</span>
          <span className="brand-tag">CV studio</span>
        </div>
        <div className="app-actions">
          <span className="template-pill">Aurora</span>
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
          {mounted ? <EditorPanel /> : <div className="pane-skeleton" />}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
          className="pane pane-preview"
          aria-label="Live preview"
        >
          <div className="preview-stage">
            <div className="paper" id="cv-paper">
              {mounted && <AuroraTemplate cv={cv} />}
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
