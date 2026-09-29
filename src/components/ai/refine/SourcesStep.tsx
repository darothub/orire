"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCVStore, type ImportMode } from "@/lib/store/cvStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { PROVIDERS, needsKey } from "@/lib/ai/types";
import type { ParsedCV } from "@/lib/ingest/parse";
import type { StructureResponse } from "@/app/api/ai/structure/route";
import { countFacts } from "./shared";

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

export function SourcesStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const cv = useCVStore((s) => s.cv);
  const applyImport = useCVStore((s) => s.applyImport);
  const provider = useSettingsStore((s) => s.provider);
  const keys = useSettingsStore((s) => s.keys);
  const models = useSettingsStore((s) => s.models);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<FileResult[] | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<number | null>(null);
  const [aiError, setAiError] = useState<{ i: number; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const facts = countFacts(cv);
  const hasContent = facts.experience + facts.education + facts.skills + facts.projects > 0;
  const apiKey = keys[provider]?.trim() ?? "";
  const hasAIKey = needsKey(provider) ? apiKey.length > 0 : true;
  const providerLabel = PROVIDERS[provider].label;

  const upload = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true); setFatal(null); setResults(null); setApplied(null);
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

  const applyHeuristic = (r: FileResult, mode: ImportMode, note: string) => {
    if (!r.parsed) return;
    applyImport(r.parsed, mode);
    setApplied(`${r.name} — ${mode === "replace" ? "replaced" : "appended"}${note}`);
  };

  const apply = async (r: FileResult, mode: ImportMode, i: number) => {
    setAiError(null);
    setApplied(null);
    // No key connected → deterministic heuristic parse (fallback path).
    if (!hasAIKey || !r.text.trim()) {
      applyHeuristic(r, mode, "");
      return;
    }
    // Key connected → structure the raw text with the connected assistant.
    setAiBusy(i);
    try {
      const res = await fetch("/api/ai/structure", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, apiKey, model: models[provider], text: r.text }),
      });
      const data = (await res.json()) as StructureResponse;
      if (data.ok && data.parsed) {
        applyImport(data.parsed, mode);
        setApplied(`${r.name} — ${mode === "replace" ? "replaced" : "appended"} · structured by ${providerLabel}`);
      } else {
        // Surface the provider error verbatim (req 12), then fall back to heuristic.
        setAiError({ i, message: data.error?.message ?? "The assistant could not structure this CV." });
        applyHeuristic(r, mode, " · assistant failed, used built-in parser");
      }
    } catch (e) {
      setAiError({ i, message: e instanceof Error ? e.message : String(e) });
      applyHeuristic(r, mode, " · assistant failed, used built-in parser");
    } finally {
      setAiBusy(null);
    }
  };

  return (
    <div className="step-body">
      <p className="step-hint">
        Upload one or more existing CVs (PDF or DOCX). We extract the text and map it into your working CV — the
        source of facts for refining. {hasAIKey
          ? `With ${providerLabel} connected, “Replace editor (AI)” structures the CV accurately; the built-in parser is used as a fallback.`
          : "Connect an assistant in step 1 for far more accurate structuring."} Already have a CV in the editor? You can skip this.
      </p>

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
                    <button className="imp-btn primary" disabled={aiBusy === i} onClick={() => apply(r, "replace", i)}>
                      {aiBusy === i ? "Structuring…" : hasAIKey ? "Replace editor (AI)" : "Replace editor"}
                    </button>
                    <button className="imp-btn" disabled={aiBusy === i} onClick={() => apply(r, "merge", i)}>Append</button>
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
          {hasContent ? "Continue" : "Skip — use current CV"}
        </button>
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
