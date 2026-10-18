"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCVStore, type ImportMode } from "@/lib/store/cvStore";
import { isSampleCV } from "@/lib/cv/sample";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { PROVIDERS } from "@/lib/ai/types";
import type { ParsedCV } from "@/lib/ingest/parse";
import { mergeParsedCVs, type MergeResult, type BasicsField } from "@/lib/ingest/merge";
import type { StructureResponse } from "@/app/api/ai/structure/route";
import { countFacts } from "./shared";
import { fmtSize, Chip, Stat, ImportNotes } from "../ImportShared";
import { analytics } from "@/lib/analytics/events";
import { useWriteGate } from "@/lib/store/accountStore";

interface FileResult {
  name: string;
  size: number;
  kind: "pdf" | "docx" | "unsupported";
  text: string;
  parsed: ParsedCV | null;
  error: string | null;
}

/** A structured import staged for review — nothing lands on the working CV
 *  until the user confirms it (the "check this" step, P1-7: this route used
 *  to apply on a single click with no review at all). */
interface PendingApply {
  r: FileResult;
  mode: ImportMode;
  parsed: ParsedCV;
  /** How it was produced, echoed in the confirmation toast. */
  via: string;
}

export function SourcesStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const cv = useCVStore((s) => s.cv);
  const applyImport = useCVStore((s) => s.applyImport);
  const provider = useSettingsStore((s) => s.provider);
  const models = useSettingsStore((s) => s.models);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<FileResult[] | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<number | null>(null);
  const [aiError, setAiError] = useState<{ i: number; message: string } | null>(null);
  const [mergePreview, setMergePreview] = useState<MergeResult | null>(null);
  const [choices, setChoices] = useState<Partial<Record<BasicsField, number>>>({});
  const [pendingApply, setPendingApply] = useState<PendingApply | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const facts = countFacts(cv);
  const isSeed = isSampleCV(cv);
  const hasContent = !isSeed && facts.experience + facts.education + facts.skills + facts.projects > 0;
  const providerLabel = PROVIDERS[provider].label;
  const writeGate = useWriteGate("upload a CV");

  const upload = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    if (!writeGate.guard()) {
      setFatal(writeGate.reason ?? "Verify your email to upload a CV.");
      return;
    }
    setBusy(true); setFatal(null); setResults(null); setApplied(null); setMergePreview(null); setChoices({}); setPendingApply(null);
    try {
      const fd = new FormData();
      for (const f of list) fd.append("files", f);
      const res = await fetch("/api/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setFatal(data?.error ? String(data.error) : `Request failed (HTTP ${res.status}).`); return; }
      setResults(data.files as FileResult[]);
      analytics.cvUploaded(list.length, "refine");
    } catch (e) {
      setFatal(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }, [writeGate]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
  }, [upload]);

  // Stage a parsed import for review rather than applying it straight to the
  // working CV (P1-7 "check this" review step — this route used to apply on
  // the first click with no confirmation at all). Nothing lands on the editor
  // until confirmApply runs.
  const stageHeuristic = (r: FileResult, mode: ImportMode, via: string) => {
    if (!r.parsed) return;
    setPendingApply({ r, mode, parsed: r.parsed, via });
  };

  const apply = async (r: FileResult, mode: ImportMode, i: number) => {
    setAiError(null);
    setApplied(null);
    // Empty extracted text → deterministic heuristic parse (fallback path).
    if (!r.text.trim()) {
      stageHeuristic(r, mode, "");
      return;
    }
    // Structure the raw text with the selected managed assistant.
    setAiBusy(i);
    try {
      const res = await fetch("/api/ai/structure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, model: models[provider], text: r.text }),
      });
      const data = (await res.json()) as StructureResponse;
      if (data.ok && data.parsed) {
        setPendingApply({ r, mode, parsed: data.parsed, via: `structured by ${providerLabel}` });
      } else {
        // Surface the provider error verbatim (req 12), then fall back to heuristic.
        setAiError({ i, message: data.error?.message ?? "The assistant could not structure this CV." });
        stageHeuristic(r, mode, "assistant failed, used built-in parser");
      }
    } catch (e) {
      setAiError({ i, message: e instanceof Error ? e.message : String(e) });
      stageHeuristic(r, mode, "assistant failed, used built-in parser");
    } finally {
      setAiBusy(null);
    }
  };

  const confirmApply = () => {
    if (!pendingApply) return;
    const { r, mode, parsed, via } = pendingApply;
    applyImport(parsed, mode);
    setApplied(`${r.name} — ${mode === "replace" ? "replaced" : "appended"}${via ? ` · ${via}` : ""}`);
    setPendingApply(null);
  };
  const cancelApply = () => setPendingApply(null);

  const parseable = (results ?? []).filter(
    (r): r is FileResult & { parsed: ParsedCV } => !!r.parsed,
  );

  const buildMerge = () => {
    if (parseable.length < 2) return;
    setAiError(null);
    setApplied(null);
    setMergePreview(mergeParsedCVs(parseable.map((r) => r.parsed)));
    setChoices({});
  };

  const applyMerged = () => {
    if (!mergePreview) return;
    const basics = { ...mergePreview.merged.basics };
    for (const c of mergePreview.conflicts) {
      basics[c.field] = c.values[choices[c.field] ?? 0];
    }
    applyImport({ ...mergePreview.merged, basics }, "replace");
    setApplied(`merged ${mergePreview.stats.files} CVs into one — replaced editor`);
    setMergePreview(null);
    setChoices({});
  };

  return (
    <div className="step-body">
      <p className="step-hint">
        Upload one or more existing CVs (PDF or DOCX). We extract the text and map it into your working CV — the
        source of facts for refining. With {providerLabel}, “Replace editor (AI)” structures the CV
        accurately; the built-in parser is used as a fallback.
      </p>

      {isSeed && (
        <motion.div className="rb-existing is-sample" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="rb-existing-main">
            <span className="rb-existing-ico" aria-hidden>✨</span>
            <div className="rb-existing-text">
              <strong>This is orire’s sample CV — not yours yet</strong>
              <span>
                Upload your own CV (PDF or DOCX) below to refine it. Or explore the flow with our
                sample using “Try with sample CV”.
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {hasContent && (
        <motion.div className="rb-existing" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="rb-existing-main">
            <span className="rb-existing-ico" aria-hidden>📄</span>
            <div className="rb-existing-text">
              <strong>
                You already have a CV in the editor{cv.basics.fullName ? ` — ${cv.basics.fullName}` : ""}
              </strong>
              <span>
                {facts.experience} roles · {facts.education} education · {facts.skills} skills
                {facts.projects ? ` · ${facts.projects} projects` : ""}. Refine it as-is, or upload a new
                file below to start fresh.
              </span>
            </div>
          </div>
          <button className="flow-btn primary" onClick={onNext}>Continue with this CV →</button>
        </motion.div>
      )}

      <div
        className={`imp-drop ${dragOver ? "over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          hidden
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
        <div className="imp-drop-inner">
          <span className="imp-drop-ico">⇪</span>
          <strong>{dragOver ? "Drop to upload" : "Drag & drop, or click to choose files"}</strong>
          <span className="imp-drop-sub">PDF · DOCX · multiple allowed</span>
        </div>
      </div>

      {busy && <div className="imp-busy">Extracting text…</div>}
      {fatal && <div className="imp-error"><strong>Upload failed</strong><pre>{fatal}</pre></div>}

      <AnimatePresence>
        {applied && (
          <motion.div className="imp-applied" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            Applied: {applied}.
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {parseable.length >= 2 && !mergePreview && (
          <motion.div className="imp-merge-bar" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="imp-merge-text">
              <strong>{parseable.length} CVs parsed.</strong>
              <span>Combine them into one de-duplicated CV — union skills, concatenate roles, keep one copy of repeats.</span>
            </div>
            <button className="imp-btn primary" onClick={buildMerge}>Merge all into one →</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mergePreview && (
          <motion.div className="imp-card imp-merge" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="imp-card-top">
              <span className="imp-badge merged">MERGED</span>
              <span className="imp-name">Combined CV from {mergePreview.stats.files} files</span>
            </div>
            <div className="imp-summary">
              <Stat label="Experience" n={mergePreview.stats.experience} />
              <Stat label="Education" n={mergePreview.stats.education} />
              <Stat label="Skills" n={mergePreview.stats.skills} />
              <Stat label="Projects" n={mergePreview.stats.projects} />
              <Stat label="Certifications" n={mergePreview.stats.certifications} />
              {mergePreview.stats.duplicatesRemoved > 0 && (
                <span className="imp-kv"><em>Deduped</em>{mergePreview.stats.duplicatesRemoved}</span>
              )}
            </div>
            <ImportNotes notes={mergePreview.merged.notes.filter((n) => !n.startsWith("Merged "))} />
            {mergePreview.conflicts.length > 0 && (
              <div className="imp-conflicts">
                <span className="ed-label">Sources disagree — pick which to keep</span>
                {mergePreview.conflicts.map((c) => (
                  <div key={c.field} className="imp-conflict">
                    <span className="imp-conflict-field">{c.label}</span>
                    <div className="imp-conflict-opts">
                      {c.values.map((v, idx) => (
                        <button
                          key={idx}
                          className={`imp-opt ${(choices[c.field] ?? 0) === idx ? "on" : ""}`}
                          onClick={() => setChoices((p) => ({ ...p, [c.field]: idx }))}
                          title={v}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="imp-actions">
              <button className="imp-btn primary" onClick={applyMerged}>Replace editor with merged CV</button>
              <button className="imp-btn" onClick={() => setMergePreview(null)}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingApply && (
          <motion.div className="imp-card imp-pending" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="imp-card-top">
              <span className="imp-badge pending">REVIEW</span>
              <span className="imp-name" title={pendingApply.r.name}>{pendingApply.r.name}</span>
              {pendingApply.via && <span className="imp-meta">{pendingApply.via}</span>}
            </div>
            <p className="step-hint">
              Nothing has changed yet. Check the extracted fields below, then{" "}
              {pendingApply.mode === "replace" ? "replace the working CV" : "append this to the working CV"} —
              or cancel and try the other assistant/mode.
            </p>
            <div className="imp-summary">
              <Chip label="Name" value={pendingApply.parsed.basics.fullName} />
              <Chip label="Title" value={pendingApply.parsed.basics.title} />
              <Chip label="Email" value={pendingApply.parsed.basics.email} />
              <Stat label="Experience" n={pendingApply.parsed.experience.length} />
              <Stat label="Education" n={pendingApply.parsed.education.length} />
              <Stat label="Skills" n={pendingApply.parsed.skills.reduce((a, g) => a + g.items.length, 0)} />
            </div>
            <ImportNotes notes={pendingApply.parsed.notes} />
            <div className="imp-actions">
              <button className="imp-btn primary" onClick={confirmApply}>
                {pendingApply.mode === "replace" ? "Looks good — replace editor" : "Looks good — append"}
              </button>
              <button className="imp-btn" onClick={cancelApply}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {results && (
        <div className="imp-results">
          {results.map((r, i) => (
            <motion.div key={`${r.name}-${i}`} className="imp-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="imp-card-top">
                <span className={`imp-badge ${r.kind}`}>{r.kind.toUpperCase()}</span>
                <span className="imp-name" title={r.name}>{r.name}</span>
                <span className="imp-meta">{fmtSize(r.size)}</span>
              </div>
              {r.error ? (
                <div className="imp-error"><strong>Could not parse this file</strong><pre>{r.error}</pre></div>
              ) : r.parsed ? (
                <>
                  <div className="imp-summary">
                    <Chip label="Name" value={r.parsed.basics.fullName} />
                    <Chip label="Title" value={r.parsed.basics.title} />
                    <Stat label="Experience" n={r.parsed.experience.length} />
                    <Stat label="Education" n={r.parsed.education.length} />
                    <Stat label="Skills" n={r.parsed.skills.reduce((a, g) => a + g.items.length, 0)} />
                  </div>
                  <div className="imp-actions">
                    <button className="imp-btn primary" disabled={aiBusy === i || !!pendingApply} onClick={() => apply(r, "replace", i)}>
                      {aiBusy === i ? "Structuring…" : "Replace editor (AI)"}
                    </button>
                    <button className="imp-btn" disabled={aiBusy === i || !!pendingApply} onClick={() => apply(r, "merge", i)}>Append</button>
                    <span className="imp-ai-hint">via {providerLabel}</span>
                  </div>
                  {aiError?.i === i && (
                    <div className="imp-error"><strong>{providerLabel} error (fell back to built-in parser)</strong><pre>{aiError.message}</pre></div>
                  )}
                </>
              ) : null}
            </motion.div>
          ))}
        </div>
      )}

      <div className="src-current">
        <span className="ed-label">Working CV</span>
        <div className="src-chips">
          <span className={facts.experience ? "" : "zero"}>{facts.experience} experience</span>
          <span className={facts.education ? "" : "zero"}>{facts.education} education</span>
          <span className={facts.skills ? "" : "zero"}>{facts.skills} skills</span>
          <span className={facts.projects ? "" : "zero"}>{facts.projects} projects</span>
        </div>
      </div>

      <div className="step-nav">
        <button className="flow-btn ghost" onClick={onBack}>Back</button>
        <button className="flow-btn primary" onClick={onNext}>
          {isSeed ? "Try with sample CV" : hasContent ? "Continue" : "Skip — use current CV"}
        </button>
      </div>
    </div>
  );
}

