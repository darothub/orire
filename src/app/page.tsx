"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { SectionOrder } from "@/components/editor/SectionOrder";
import { TemplatePicker } from "@/components/templates/TemplatePicker";
import { WorkspaceRail } from "@/components/WorkspaceRail";
import { RefineFlow } from "@/components/ai/RefineFlow";
import { ProviderSetup } from "@/components/ai/ProviderSetup";
import { RateView } from "@/components/ai/RatingPanel";
import { SimulateView } from "@/components/ai/SimulatePanel";
import { ProgressView } from "@/components/ProgressPanel";
import { getTemplate } from "@/components/templates/registry";
import { useUIStore } from "@/lib/store/uiStore";
import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { useRefineStore } from "@/lib/store/refineStore";

/** Edit workspace: section reorder + field editor. Right pane shows it live. */
function EditView({ mounted }: { mounted: boolean }) {
  return (
    <motion.div
      className="ws-view edit-view"
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ws-head">
        <div>
          <h2>Edit</h2>
          <p>Changes appear live on the right. Drag sections, cards and bullets to reorder.</p>
        </div>
      </div>
      {mounted ? (
        <>
          <SectionOrder />
          <EditorPanel />
        </>
      ) : (
        <div className="pane-skeleton" />
      )}
    </motion.div>
  );
}

/** Standalone connection view — reused as Refine's first step via ProviderSetup. */
function ConnectView() {
  return (
    <motion.div
      className="ws-view connect-view"
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ws-head">
        <div>
          <h2>Connect AI</h2>
          <p>
            Bring your own key. Nothing is stored server-side — keys live only in this browser and
            are sent straight to the provider you pick.
          </p>
        </div>
      </div>
      <ProviderSetup />
    </motion.div>
  );
}

function Workspace({ mounted }: { mounted: boolean }) {
  const view = useViewStore((s) => s.view);
  const dir = useViewStore((s) => s.dir);

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div key={view} className="ws-swap" custom={dir}>
          {view === "edit" && <EditView mounted={mounted} />}
          {view === "refine" && <RefineFlow />}
          {view === "simulate" && <SimulateView />}
          {view === "rate" && <RateView />}
          {view === "progress" && <ProgressView />}
          {view === "connect" && <ConnectView />}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  // Intentional one-shot hydration guard: render the client-only editor after
  // mount so SSR and first client render match. This is the sanctioned use of
  // setState-in-effect, not a data-sync mistake.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const cv = useCVStore((s) => s.cv);
  const active = useCVStore((s) => s.activeTemplate);
  const reset = useCVStore((s) => s.reset);
  const previewEdit = useUIStore((s) => s.previewEdit);
  const togglePreviewEdit = useUIStore((s) => s.togglePreviewEdit);

  // During a 2-provider Refine comparison, widen the workspace pane so the
  // side-by-side columns breathe and de-emphasise the live preview.
  const view = useViewStore((s) => s.view);
  const refStep = useRefineStore((s) => s.step);
  const refStarted = useRefineStore((s) => s.started);
  const refCompare = useRefineStore((s) => s.runProviders.length === 2);
  const compareWide = view === "refine" && refStep === "run" && refStarted && refCompare;

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
    <div className="app has-rail">
      <header className="app-bar">
        <div className="brand">
          <span className="brand-dot" />
          <span className="brand-name">orire</span>
          <span className="brand-tag">CV studio</span>
        </div>
        <div className="app-actions">
          <span className="template-pill">{mounted ? tpl.name : "—"}</span>
          <button
            className={`btn-ghost${mounted && previewEdit ? " is-active" : ""}`}
            onClick={togglePreviewEdit}
            aria-pressed={mounted && previewEdit}
            title="Click text on the preview to edit it in place"
          >
            {mounted && previewEdit ? "Editing preview" : "Edit on preview"}
          </button>
          <button className="btn-ghost" onClick={reset}>Reset</button>
          <button className="btn-primary" onClick={exportPDF}>Export PDF</button>
        </div>
      </header>

      <main className={`workspace${compareWide ? " is-compare" : ""}`}>
        <WorkspaceRail />

        <section className="pane pane-work" aria-label="Workspace">
          <Workspace mounted={mounted} />
        </section>

        <motion.section
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
          className="pane pane-preview"
          aria-label="Live preview"
        >
          {mounted && <TemplatePicker />}
          <div className="preview-stage">
            <MotionConfig reducedMotion="user">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 26, scale: 0.965, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -18, scale: 0.975, filter: "blur(5px)" }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className={`paper${mounted && previewEdit ? " is-editing" : ""}`}
                  id="cv-paper"
                >
                  {mounted && <ActiveTemplate cv={cv} />}
                  <span key={`sweep-${active}`} className="tpl-sweep" aria-hidden />
                </motion.div>
              </AnimatePresence>
            </MotionConfig>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
