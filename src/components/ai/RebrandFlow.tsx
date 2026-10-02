"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { usePooledStore } from "@/lib/store/pooledStore";
import { useRebrandStore } from "@/lib/store/rebrandStore";
import { useViewStore } from "@/lib/store/viewStore";
import { PROVIDERS, needsKey } from "@/lib/ai/types";
import { cvDataFromParsed } from "@/lib/cv/fromParsed";
import { countFacts } from "./refine/shared";
import type { ParsedCV } from "@/lib/ingest/parse";
import type { StructureResponse } from "@/app/api/ai/structure/route";

interface FileResult {
  name: string;
  size: number;
  kind: "pdf" | "docx" | "unsupported";
  text: string;
  parsed: ParsedCV | null;
  error: string | null;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Re-brand flow (req 3). Distinct from Refine (which tailors to a job): it takes
 * an existing CV — uploaded or the working document — restructures it into a
 * clean, fact-grounded CV, and lets the user audition any template with a live
 * output preview (shown in the right pane) before committing. No job description.
 */
export function RebrandFlow() {
  const step = useRebrandStore((s) => (s.draft ? "brand" : "upload"));
  return step === "brand" ? <BrandStep /> : <UploadStep />;
}

function UploadStep() {
  const cv = useCVStore((s) => s.cv);
  const provider = useSettingsStore((s) => s.provider);
  const keys = useSettingsStore((s) => s.keys);
  const models = useSettingsStore((s) => s.models);
  const setDraft = useRebrandStore((s) => s.setDraft);

  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<FileResult[] | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<number | null>(null);
  const [aiError, setAiError] = useState<{ i: number; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const apiKey = keys[provider]?.trim() ?? "";
  const pooled = usePooledStore((s) => s.providers);
  const hasAIKey = needsKey(provider) ? apiKey.length > 0 || pooled.includes(provider) : true;
  const providerLabel = PROVIDERS[provider].label;
  const facts = countFacts(cv);
  const hasWorking = facts.experience + facts.education + facts.skills + facts.projects > 0;

  const upload = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true); setFatal(null); setResults(null); setAiError(null);
    try {
      const fd = new FormData();
      for (const f of list) fd.append("files", f);
      const res = await fetch("/api/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setFatal(data?.error ? String(data.error) : `Request failed (HTTP ${res.status}).`); return; }
      setResults(data.files as FileResult[]);
    } catch (e) {
      setFatal(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
  }, [upload]);

  const rebrandFrom = async (r: FileResult, i: number) => {
    if (!r.parsed) return;
    setAiError(null);
    // No key (or no text) → deterministic heuristic parse.
    if (!hasAIKey || !r.text.trim()) {
      setDraft(cvDataFromParsed(r.parsed), r.name, "built-in parser");
      return;
    }
    setAiBusy(i);
    try {
      const res = await fetch("/api/ai/structure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, apiKey, model: models[provider], text: r.text }),
      });
      const data = (await res.json()) as StructureResponse;
      if (data.ok && data.parsed) {
        setDraft(cvDataFromParsed(data.parsed), r.name, `structured by ${providerLabel}`);
      } else {
        // Surface the provider error verbatim (req 12), then fall back.
        setAiError({ i, message: data.error?.message ?? "The assistant could not structure this CV." });
        setDraft(cvDataFromParsed(r.parsed), r.name, "assistant failed · built-in parser");
      }
    } catch (e) {
      setAiError({ i, message: e instanceof Error ? e.message : String(e) });
      setDraft(cvDataFromParsed(r.parsed), r.name, "assistant failed · built-in parser");
    } finally {
      setAiBusy(null);
    }
  };

  const useWorking = () => {
    setDraft(JSON.parse(JSON.stringify(cv)), "current working CV", "your current CV");
  };

  return (
    <div className="ws-view rebrand-flow">
      <div className="ws-head">
        <div>
          <h2>Re-brand a CV</h2>
          <p>
            Drop in an existing CV (or use the one you&apos;re working on) and we&apos;ll restructure it into a clean,
            fact-grounded document — then audition any template with a live output preview before you commit. No job
            description, no invented content.
          </p>
        </div>
      </div>

      <div className="step-body">
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
            <strong>{dragOver ? "Drop to re-brand" : "Drag & drop, or click to choose files"}</strong>
            <span className="imp-drop-sub">PDF · DOCX · {hasAIKey ? `structured by ${providerLabel}` : "built-in parser"}</span>
          </div>
        </div>

        {hasWorking && (
          <div className="rb-orline">
            <span>or</span>
            <button className="flow-btn" onClick={useWorking}>Re-brand my current CV →</button>
          </div>
        )}

        {busy && <div className="imp-busy">Extracting text…</div>}
        {fatal && <div className="imp-error"><strong>Upload failed</strong><pre>{fatal}</pre></div>}

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
                      <button className="imp-btn primary" disabled={aiBusy === i} onClick={() => rebrandFrom(r, i)}>
                        {aiBusy === i ? "Restructuring…" : hasAIKey ? "Re-brand this (AI)" : "Re-brand this"}
                      </button>
                      {hasAIKey && <span className="imp-ai-hint">via {providerLabel}</span>}
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
      </div>
    </div>
  );
}

function BrandStep() {
  const draft = useRebrandStore((s) => s.draft);
  const sourceName = useRebrandStore((s) => s.sourceName);
  const via = useRebrandStore((s) => s.via);
  const templateId = useRebrandStore((s) => s.templateId);
  const resetRebrand = useRebrandStore((s) => s.reset);
  const loadCV = useCVStore((s) => s.loadCV);
  const setTemplate = useCVStore((s) => s.setTemplate);
  const captureBaseline = useCVStore((s) => s.captureBaseline);
  const setView = useViewStore((s) => s.setView);
  const [applied, setApplied] = useState(false);

  if (!draft) return null;
  const facts = countFacts(draft);

  const apply = () => {
    // Snapshot where we started so the re-branded result can be rated (req 16).
    captureBaseline();
    loadCV(draft);
    setTemplate(templateId);
    resetRebrand();
    setApplied(true);
    setTimeout(() => setView("edit"), 450);
  };

  return (
    <div className="ws-view rebrand-flow">
      <div className="ws-head">
        <div>
          <h2>Choose a look</h2>
          <p>
            Your re-branded CV is ready. Pick a template from the gallery on the right — each card previews
            <em> your content</em>, and the page below shows the full output. Apply when it feels right.
          </p>
        </div>
        <button className="ws-reset" onClick={resetRebrand} title="Start the re-brand over">Restart</button>
      </div>

      <div className="step-body">
        <div className="rb-source">
          <span className="ed-label">Re-branding</span>
          <div className="rb-source-row">
            <strong>{sourceName}</strong>
            {via && <span className="rb-via">{via}</span>}
          </div>
          <div className="src-chips">
            <span className={facts.experience ? "" : "zero"}>{facts.experience} experience</span>
            <span className={facts.education ? "" : "zero"}>{facts.education} education</span>
            <span className={facts.skills ? "" : "zero"}>{facts.skills} skills</span>
            <span className={facts.projects ? "" : "zero"}>{facts.projects} projects</span>
          </div>
        </div>

        <p className="step-hint">
          Nothing is changed in your editor until you apply. Applying replaces the working CV with this
          re-branded version and keeps your original as the baseline for rating.
        </p>

        <AnimatePresence>
          {applied && (
            <motion.div className="imp-applied" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              Re-brand applied — opening the editor…
            </motion.div>
          )}
        </AnimatePresence>

        <div className="step-nav">
          <button className="flow-btn ghost" onClick={resetRebrand}>Start over</button>
          <button className="flow-btn primary" disabled={applied} onClick={apply}>Apply re-brand</button>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return <span className="imp-kv"><em>{label}</em>{value}</span>;
}
function Stat({ label, n }: { label: string; n: number }) {
  return <span className={`imp-kv ${n === 0 ? "zero" : ""}`}><em>{label}</em>{n}</span>;
}
