"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { SectionOrder } from "@/components/editor/SectionOrder";
import { TemplatePicker } from "@/components/templates/TemplatePicker";
import { WorkspaceRail } from "@/components/WorkspaceRail";
import { RefineFlow } from "@/components/ai/RefineFlow";
import { RebrandFlow } from "@/components/ai/RebrandFlow";
import { ProviderSetup } from "@/components/ai/ProviderSetup";
import { PlanPanel } from "@/components/PlanPanel";
import { TeamPanel } from "@/components/TeamPanel";
import { RateView } from "@/components/ai/RatingPanel";
import { TargetView } from "@/components/ai/TargetPanel";
import { ProgressView } from "@/components/ProgressPanel";
import { HistoryView } from "@/components/HistoryView";
import { ExportView } from "@/components/export/ExportView";
import { CommandPalette } from "@/components/CommandPalette";
import { PreviewToolbar } from "@/components/PreviewToolbar";
import { AccountButton } from "@/components/auth/AccountButton";
import { CloudSync } from "@/components/auth/CloudSync";
import { getTemplate } from "@/components/templates/registry";
import { useUIStore } from "@/lib/store/uiStore";
import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { targetMatch } from "@/lib/ai/simulate";
import { useRebrandStore } from "@/lib/store/rebrandStore";
import { useRefineStore } from "@/lib/store/refineStore";
import { useStyleStore, paperStyleVars } from "@/lib/store/styleStore";
import { usePreviewStore } from "@/lib/store/previewStore";

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
      <PlanPanel />
      <TeamPanel />
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
          {view === "rebrand" && <RebrandFlow />}
          {view === "refine" && <RefineFlow />}
          {view === "target" && <TargetView />}
          {view === "rate" && <RateView />}
          {view === "progress" && <ProgressView />}
          {view === "history" && <HistoryView />}
          {view === "export" && <ExportView />}
          {view === "connect" && <ConnectView />}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}

/** Compact header chip: live match to the locked target + trend since locking. */
function TargetChip({ mounted }: { mounted: boolean }) {
  const ideal = useTargetStore((s) => s.ideal);
  const jd = useTargetStore((s) => s.jd);
  const baseScore = useTargetStore((s) => s.baseScore);
  const cv = useCVStore((s) => s.cv);
  const setView = useViewStore((s) => s.setView);

  if (!mounted || !ideal) return null;

  const score = targetMatch(cv, ideal, jd).score;
  const delta = score - baseScore;
  const hue = Math.round((score / 100) * 130);

  return (
    <button
      className="tgt-chip"
      onClick={() => setView("target")}
      title="Open the Target page — edit your CV against the locked ideal"
      style={{ ["--tgt-hue" as string]: String(hue) }}
    >
      <span className="tgt-chip-ic" aria-hidden>🎯</span>
      <span className="tgt-chip-val">{score}%</span>
      {delta !== 0 && (
        <span className={`tgt-chip-delta ${delta > 0 ? "up" : "down"}`}>
          {delta > 0 ? "▲" : "▼"}{Math.abs(delta)}
        </span>
      )}
    </button>
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
  const setView = useViewStore((s) => s.setView);
  const refStep = useRefineStore((s) => s.step);
  const refStarted = useRefineStore((s) => s.started);
  const refCompare = useRefineStore((s) => s.runProviders.length === 2);
  const compareWide = view === "refine" && refStep === "run" && refStarted && refCompare;
  // The Target page renders its own side-by-side split, so it also takes the
  // full workspace width and hides the single live-preview pane.
  const wide = compareWide || view === "target";

  // Re-brand (req 3): while in the re-brand workspace with a draft, the right
  // pane previews the restructured draft in the auditioned template so the user
  // sees the exact output before applying. Otherwise it shows the working CV.
  const rebrandDraft = useRebrandStore((s) => s.draft);
  const rebrandTpl = useRebrandStore((s) => s.templateId);
  const setRebrandTpl = useRebrandStore((s) => s.setTemplate);
  const showRebrand = view === "rebrand" && !!rebrandDraft;
  const previewCV = showRebrand && rebrandDraft ? rebrandDraft : cv;
  const previewTplId = showRebrand ? rebrandTpl : active;

  // Live typography (font / size / alignment) applied to the CV paper so the
  // preview — and the exported PDF captured from it — reflect the choices.
  const fontId = useStyleStore((s) => s.fontId);
  const size = useStyleStore((s) => s.size);
  const cvAlign = useStyleStore((s) => s.align);
  const paperVars = mounted ? paperStyleVars({ fontId, size, align: cvAlign }) : {};

  // Live-preview viewport: zoom + A4 page-break guides. We measure the paper's
  // rendered height (so guides land on real A4 boundaries) and the stage width
  // (so "Fit" can size the paper to the pane), keeping both fresh on resize.
  const zoom = usePreviewStore((s) => s.zoom);
  const showGuides = usePreviewStore((s) => s.showGuides);
  const setFitZoom = usePreviewStore((s) => s.setFitZoom);
  const stageRef = useRef<HTMLDivElement>(null);
  const [paperH, setPaperH] = useState(1123);

  useEffect(() => {
    if (!mounted) return;
    const paper = document.getElementById("cv-paper");
    const stage = stageRef.current;
    if (!paper || !stage) return;
    const measure = () => {
      setPaperH(paper.offsetHeight || 1123);
      const avail = stage.clientWidth - 68; // matches .preview-stage h-padding
      setFitZoom(avail / 794);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(paper);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [mounted, previewTplId, previewCV, setFitZoom]);

  const A4_PX = 1123;
  const pageCount = Math.max(1, Math.ceil((paperH - 2) / A4_PX));

  const tpl = getTemplate(previewTplId);
  const ActiveTemplate = tpl.Component;

  return (
    <div className="app has-rail">
      <header className="app-bar">
        <div className="brand">
          <span className="brand-dot" />
          <span className="brand-name">orire</span>
          <span className="brand-tag">CV studio</span>
        </div>
        <div className="app-actions">
          <button
            className="cmdk-hint-btn"
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            title="Open command palette"
            aria-label="Open command palette"
          >
            <span className="cmdk-search-ic" aria-hidden>⌕</span>
            <span className="cmdk-hint-lbl">Search</span>
            <kbd>⌘K</kbd>
          </button>
          <span className="template-pill">{mounted ? tpl.name : "—"}</span>
          <TargetChip mounted={mounted} />
          <button
            className={`btn-ghost${mounted && previewEdit ? " is-active" : ""}`}
            onClick={togglePreviewEdit}
            aria-pressed={mounted && previewEdit}
            title="Click text on the preview to edit it in place"
          >
            {mounted && previewEdit ? "Editing preview" : "Edit on preview"}
          </button>
          <button className="btn-ghost" onClick={reset}>Reset</button>
          <button className="btn-primary" onClick={() => setView("export")}>Export PDF</button>
          <AccountButton />
        </div>
      </header>
      <CloudSync />

      <main className={`workspace${wide ? " is-compare" : ""}`}>
        <WorkspaceRail />

        <section className="pane pane-work" aria-label="Workspace">
          <Workspace mounted={mounted} />
        </section>

        <MotionConfig reducedMotion="user">
          <AnimatePresence initial={false}>
            {!wide && (
              <motion.section
                key="preview"
                initial={{ opacity: 0, x: "6%" }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: "100%" }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="pane pane-preview"
                aria-label="Live preview"
              >
                {mounted && (showRebrand
                  ? <TemplatePicker cv={previewCV} active={previewTplId} onSelect={setRebrandTpl} />
                  : <TemplatePicker />)}
                {mounted && <PreviewToolbar />}
                <div className="preview-stage" ref={stageRef}>
                  <div
                    className="paper-frame"
                    style={{ width: 794 * zoom, height: paperH * zoom }}
                  >
                    <div
                      className="paper-scaler"
                      style={{ transform: `scale(${zoom})`, width: 794, height: paperH }}
                    >
                      <MotionConfig reducedMotion="user">
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.div
                            key={previewTplId}
                            initial={{ opacity: 0, y: 26, scale: 0.965, filter: "blur(6px)" }}
                            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -18, scale: 0.975, filter: "blur(5px)" }}
                            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                            className={`paper${mounted && previewEdit && !showRebrand ? " is-editing" : ""}`}
                            id="cv-paper"
                            style={paperVars}
                          >
                            {mounted && <ActiveTemplate cv={previewCV} />}
                            <span key={`sweep-${previewTplId}`} className="tpl-sweep" aria-hidden />
                          </motion.div>
                        </AnimatePresence>
                      </MotionConfig>
                      {mounted && showGuides && pageCount > 1 && (
                        <div className="page-guides" aria-hidden>
                          {Array.from({ length: pageCount - 1 }, (_, i) => (
                            <div key={i} className="page-guide" style={{ top: (i + 1) * A4_PX }}>
                              <span className="page-guide-lbl">Page {i + 2}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </MotionConfig>
      </main>

      <CommandPalette />
    </div>
  );
}
