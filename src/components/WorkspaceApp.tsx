"use client";

import { GuidedBar } from "@/components/ai/RunAll";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { CreatorFlow } from "@/components/creator/CreatorFlow";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { BrandMark } from "@/components/BrandMark";
import { SectionOrder } from "@/components/editor/SectionOrder";
import { TemplatePicker } from "@/components/templates/TemplatePicker";
import { WorkspaceRail } from "@/components/WorkspaceRail";
import { RefineFlow } from "@/components/ai/RefineFlow";
import { TailorView } from "@/components/ai/TailorView";
import { CoachView } from "@/components/ai/CoachView";
import { RebrandFlow } from "@/components/ai/RebrandFlow";
import { ProviderSetup } from "@/components/ai/ProviderSetup";
import { PlanPanel } from "@/components/PlanPanel";
import { RateView } from "@/components/ai/RatingPanel";
import { TargetView } from "@/components/ai/TargetPanel";
import { CoverLetterView } from "@/components/ai/CoverLetterView";
import { LibraryView } from "@/components/LibraryView";
import { ProfileView } from "@/components/ProfileView";
import { ExportView } from "@/components/export/ExportView";
import { SpotlightView } from "@/components/SpotlightView";
import { CommandPalette } from "@/components/CommandPalette";
import { PreviewToolbar } from "@/components/PreviewToolbar";
import { AccountButton } from "@/components/auth/AccountButton";
import { OccEntry } from "@/components/occ/OccEntry";
import { SyncStatus } from "@/components/auth/SyncStatus";
import { CloudSync } from "@/components/auth/CloudSync";
import { OnboardingTour } from "@/components/OnboardingTour";
import { useOnboardingStore, hasSeenOnboarding } from "@/lib/store/onboardingStore";
import { getTemplate } from "@/components/templates/registry";
import { useUIStore, readPendingPlanIntent } from "@/lib/store/uiStore";
import { useCVStore } from "@/lib/store/cvStore";
import { VIEW_META, ACCOUNT_VIEWS } from "@/lib/store/viewMeta";
import { useSession } from "next-auth/react";
import { clearResumeOverlay } from "@/lib/resume";
import { persistView, restoreView, useViewStore } from "@/lib/store/viewStore";
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
          <h2>{VIEW_META.edit.label}</h2>
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
          <h2>{VIEW_META.connect.label}</h2>
          <p>
            Assistants are provided by Orire. Pick your default assistant and
            the models to run; your plan sets which models are available.
          </p>
        </div>
      </div>
      <ProviderSetup />
    </motion.div>
  );
}

/** Standalone pricing workspace — plans & checkout, promoted out of Connect. */
function PlansView() {
  return (
    <motion.div
      className="ws-view plans-view"
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ws-head">
        <div>
          <h2>{VIEW_META.plans.label}</h2>
          <p>
            Pick the plan that fits how you job-hunt. Upgrade, downgrade or cancel
            anytime, your monthly usage and entitlement are tracked server-side.
          </p>
        </div>
      </div>
      <PlanPanel />
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
          <GuidedBar />
          {view === "spotlight" && <SpotlightView />}
          {view === "edit" && <EditView mounted={mounted} />}
          {view === "create" && <CreatorFlow mounted={mounted} />}
          {view === "rebrand" && <RebrandFlow />}
          {view === "tailor" && <TailorView />}
          {view === "refine" && <RefineFlow />}
          {view === "coach" && <CoachView />}
          {view === "target" && <TargetView />}
          {view === "cover" && <CoverLetterView />}
          {view === "rate" && <RateView />}
          {view === "history" && <LibraryView />}
          {view === "export" && <ExportView />}
          {view === "plans" && <PlansView />}
          {view === "connect" && <ConnectView />}
          {view === "profile" && <ProfileView />}
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
      title="Open simulated match guidance, not an ATS score or hiring prediction"
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

/** Secondary actions kept out of the bar so the header stays quiet. */
function HeaderMenu({
  mounted,
  templateName,
  previewEdit,
  onTogglePreviewEdit,
  onTour,
  onReset,
}: {
  mounted: boolean;
  templateName: string;
  previewEdit: boolean;
  onTogglePreviewEdit: () => void;
  onTour: () => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="hm-wrap" ref={wrapRef}>
      <button
        type="button"
        className="hm-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden>⋯</span>
      </button>
      {open && (
        <div className="hm-pop" role="menu" aria-label="More actions">
          <div className="hm-row" role="presentation">
            <span>Template</span>
            <strong>{mounted ? templateName : "—"}</strong>
          </div>
          <button type="button" role="menuitemcheckbox" aria-checked={mounted && previewEdit} className="hm-item" onClick={run(onTogglePreviewEdit)}>
            {mounted && previewEdit ? "Editing preview, turn off" : "Edit on preview"}
          </button>
          <button type="button" role="menuitem" className="hm-item" onClick={run(onTour)}>Take the tour</button>
          <button type="button" role="menuitem" className="hm-item hm-danger" onClick={run(onReset)}>Reset CV</button>
        </div>
      )}
    </div>
  );
}

export default function WorkspaceApp() {
  const [mounted, setMounted] = useState(false);
  // Intentional one-shot hydration guard: render the client-only editor after
  // mount so SSR and first client render match. This is the sanctioned use of
  // setState-in-effect, not a data-sync mistake.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // First-run guide (req: onboarding). Auto-open the spotlight tour once per
  // device the first time the workspace is revealed (after login or "explore").
  // Gated by a localStorage flag in the store so returning users never see it;
  // it can be replayed from the command palette.
  const startTour = useOnboardingStore((s) => s.start);
  useEffect(() => {
    if (!mounted) return;
    if (hasSeenOnboarding()) return;
    const t = setTimeout(() => startTour(), 700);
    return () => clearTimeout(t);
  }, [mounted, startTour]);

  const cv = useCVStore((s) => s.cv);
  const active = useCVStore((s) => s.activeTemplate);
  const reset = useCVStore((s) => s.reset);
  const { status: sessionStatus } = useSession();
  const guest = sessionStatus === "unauthenticated";
  const openAuth = useUIStore((s) => s.openAuth);
  const previewEdit = useUIStore((s) => s.previewEdit);
  const togglePreviewEdit = useUIStore((s) => s.togglePreviewEdit);
  const mobilePane = useUIStore((s) => s.mobilePane);
  const setMobilePane = useUIStore((s) => s.setMobilePane);
  const intendedPlan = useUIStore((s) => s.intendedPlan);
  const clearIntendedPlan = useUIStore((s) => s.clearIntendedPlan);

  // During a 2-provider Refine comparison, widen the workspace pane so the
  // side-by-side columns breathe and de-emphasise the live preview.
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const refStep = useRefineStore((s) => s.step);

  // A refresh keeps the current workspace instead of resetting to Home.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = restoreView();
    if (saved) setView(saved);
    requestAnimationFrame(() => requestAnimationFrame(clearResumeOverlay));
  }, [setView]);
  useEffect(() => {
    if (restored.current) persistView(view);
  }, [view]);

  // Preserve pricing intent: a visitor who clicked "Choose Pro/Career" on the
  // landing lands on the Plans view after signing up, so they can complete the
  // plan they picked. Free (or no) intent just enters the app normally.
  useEffect(() => {
    const selectedPlan = intendedPlan ?? readPendingPlanIntent();
    if (!selectedPlan || selectedPlan === "free") return;
    setView("plans");
    clearIntendedPlan();
  }, [intendedPlan, setView, clearIntendedPlan]);
  // Guests reaching an account-only view by any path (palette, restored state)
  // are sent back to the editor with the sign-up prompt.
  useEffect(() => {
    const reason = guest ? ACCOUNT_VIEWS[view] : undefined;
    if (!reason) return;
    setView("edit");
    openAuth("signup", null, reason);
  }, [guest, view, setView, openAuth]);
  const refStarted = useRefineStore((s) => s.started);
  const refCompare = useRefineStore((s) => s.runProviders.length === 2);
  const compareWide = view === "refine" && refStep === "run" && refStarted && refCompare;
  // The Target page renders its own side-by-side split, so it also takes the
  // full workspace width and hides the single live-preview pane.
  const wide = compareWide || view === "target" || view === "rate" || view === "cover" || view === "spotlight";

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
  const setZoom = usePreviewStore((s) => s.setZoom);
  const fitZoom = usePreviewStore((s) => s.fitZoom);
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

  // On narrow viewports the A4 paper (794px) is wider than the stage, so snap
  // the preview to its fit-zoom automatically (desktop keeps the user's zoom).
  // Re-runs when the fit value changes or the mobile pane becomes the preview.
  useEffect(() => {
    if (!mounted) return;
    if (window.matchMedia("(max-width: 820px)").matches) setZoom(fitZoom);
  }, [mounted, fitZoom, mobilePane, view, setZoom]);

  const A4_PX = 1123;
  const pageCount = Math.max(1, Math.ceil((paperH - 2) / A4_PX));

  const tpl = getTemplate(previewTplId);
  const ActiveTemplate = tpl.Component;

  return (
    <div className="app has-rail" data-hydrated={mounted}>
          <a className="skip-to-main" href="#main-content">Skip to main content</a>
      <header className="app-bar">
        <div className="brand">
          <span className="brand-dot"><BrandMark size={26} /></span>
          <span className="brand-name">Orire</span>
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
          <TargetChip mounted={mounted} />
          <HeaderMenu
            mounted={mounted}
            templateName={tpl.name}
            previewEdit={previewEdit}
            onTogglePreviewEdit={togglePreviewEdit}
            onTour={startTour}
            onReset={reset}
          />
          <button
            className="btn-primary"
            onClick={() => {
              if (guest) openAuth("signup", null, ACCOUNT_VIEWS.export);
              else setView("export");
            }}
          >
            Export PDF
          </button>
          <SyncStatus />
          <OccEntry />
          <AccountButton />
        </div>
      </header>
      <CloudSync />

      <main id="main-content" className={`workspace${wide ? " is-compare" : ""}`} data-mpane={mobilePane} tabIndex={-1}>
        <WorkspaceRail />

        {!wide && (
          <div className="mpane-switch" role="tablist" aria-label="Switch pane">
            <button
              role="tab"
              aria-selected={mobilePane === "work"}
              className={`mpane-btn${mobilePane === "work" ? " is-on" : ""}`}
              onClick={() => setMobilePane("work")}
            >
              <span aria-hidden>✎</span> Edit
            </button>
            <button
              role="tab"
              aria-selected={mobilePane === "preview"}
              className={`mpane-btn${mobilePane === "preview" ? " is-on" : ""}`}
              onClick={() => setMobilePane("preview")}
            >
              <span aria-hidden>▦</span> Preview
            </button>
          </div>
        )}

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
      <OnboardingTour />
    </div>
  );
}
