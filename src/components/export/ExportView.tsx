"use client";

import { motion } from "framer-motion";
import { VIEW_META } from "@/lib/store/viewMeta";
import { PAGE_MODES } from "@/lib/cv/page";
import {
  useStyleStore,
  FONT_OPTIONS,
  SIZE_STEPS,
  type CVAlign,
} from "@/lib/store/styleStore";
import { useCvExport } from "@/lib/export/useCvExport";

const ALIGNS: { id: CVAlign; label: string; icon: string }[] = [
  { id: "left", label: "Left", icon: "⇤" },
  { id: "justify", label: "Justify", icon: "≡" },
  { id: "right", label: "Right", icon: "⇥" },
];

export function ExportView() {
  const fontId = useStyleStore((s) => s.fontId);
  const size = useStyleStore((s) => s.size);
  const align = useStyleStore((s) => s.align);
  const setFont = useStyleStore((s) => s.setFont);
  const setSize = useStyleStore((s) => s.setSize);
  const setAlign = useStyleStore((s) => s.setAlign);
  const resetStyle = useStyleStore((s) => s.resetStyle);

  const {
    defaultName, fileName, setFileName, company, setCompany, mode, setMode, embedData, setEmbedData,
    busyFormat, busy, msg, gate, copyPlainText, doExport,
  } = useCvExport();

  const sizePct = Math.round(size * 100);

  return (
    <motion.div
      className="ws-view export-view"
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ws-head">
        <div>
          <h2>{VIEW_META.export.label}</h2>
          <p>
            Style the CV and download as <strong>PDF</strong> or <strong>Word (.docx)</strong>.
            Page layout options apply to the <strong>PDF</strong> (pixel-true template snapshot).
            Word is a clean, single-column, ATS-friendly file built from your content, not a visual clone of the template.
            Plain-text copy for application forms is free and does not use a download.
          </p>
        </div>
      </div>

      <section className="exp-sec">
        <h4 className="exp-sec-title">Typography</h4>
        <label className="exp-field">
          <span className="exp-label">Font</span>
          <div className="exp-fonts">
            {FONT_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`exp-chip${fontId === f.id ? " is-on" : ""}`}
                onClick={() => setFont(f.id)}
                style={f.sans ? { fontFamily: f.sans } : undefined}
                aria-pressed={fontId === f.id}
              >
                {f.label}
                {fontId === f.id && <motion.span layoutId="exp-font-ring" className="exp-chip-ring" transition={{ type: "spring", stiffness: 480, damping: 34 }} />}
              </button>
            ))}
          </div>
        </label>

        <div className="exp-row2">
          <label className="exp-field">
            <span className="exp-label">Text size <span className="exp-opt">· {sizePct}%</span></span>
            <input
              type="range"
              className="exp-range"
              min={0}
              max={SIZE_STEPS.length - 1}
              step={1}
              value={Math.max(0, SIZE_STEPS.indexOf(size as (typeof SIZE_STEPS)[number]))}
              onChange={(e) => setSize(SIZE_STEPS[Number(e.target.value)])}
            />
          </label>

          <div className="exp-field">
            <span className="exp-label">Alignment</span>
            <div className="exp-aligns">
              {ALIGNS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`exp-align${align === a.id ? " is-on" : ""}`}
                  onClick={() => setAlign(a.id)}
                  title={a.label}
                  aria-pressed={align === a.id}
                >
                  <span aria-hidden>{a.icon}</span>
                  <em>{a.label}</em>
                </button>
              ))}
            </div>
          </div>
        </div>
        <button className="exp-reset" onClick={resetStyle} type="button">Reset styling</button>
      </section>

      <section className="exp-sec">
        <h4 className="exp-sec-title">PDF page layout</h4>
        <p className="exp-sec-hint">Affects Download PDF only. Word (.docx) always uses a standard single-column layout.</p>
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
              {mode === m.id && <motion.span layoutId="exp-mode-ring" className="exp-mode-ring" transition={{ type: "spring", stiffness: 480, damping: 34 }} />}
            </button>
          ))}
        </div>
        <label className="exp-embed-toggle">
          <input
            type="checkbox"
            checked={embedData}
            onChange={(e) => setEmbedData(e.target.checked)}
          />
          <span>
            Include re-import data
            <em>
              {embedData
                ? "This exact PDF can be re-imported later with no loss. The full CV data travels invisibly inside the file, turn off before sending it somewhere that shouldn't receive that."
                : "This PDF won’t carry your full CV data in its metadata. Re-importing it later will go through the normal parser instead of a lossless round-trip."}
            </em>
          </span>
        </label>
      </section>

      <section className="exp-sec">
        <h4 className="exp-sec-title">Save</h4>
        <div className="exp-row2">
          <label className="exp-field">
            <span className="exp-label">File name</span>
            <input className="ed-input" value={fileName} spellCheck={false} onChange={(e) => setFileName(e.target.value)} placeholder={defaultName} />
          </label>
          <label className="exp-field">
            <span className="exp-label">Company <span className="exp-opt">· for History</span></span>
            <input className="ed-input" value={company} spellCheck={false} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Acme Corp" />
          </label>
        </div>
      </section>

      {msg && <p className={`exp-msg ${msg.kind}`}>{msg.text}</p>}
      {gate.ready && !gate.allowed && !msg && (
        <p className="exp-msg err">{gate.reason}</p>
      )}

      <div className="exp-actions wide">
        <button className="flow-btn primary lg" onClick={() => void doExport("pdf")} disabled={busy}>
          {busyFormat === "pdf" ? <><span className="cmp-spinner" /> Building PDF…</> : "Download PDF"}
        </button>
        <button className="flow-btn lg" onClick={() => void doExport("docx")} disabled={busy}>
          {busyFormat === "docx" ? <><span className="cmp-spinner" /> Building Word…</> : "Download Word (.docx)"}
        </button>
        <button className="flow-btn lg" onClick={() => void doExport("txt")} disabled={busy}>
          {busyFormat === "txt" ? <><span className="cmp-spinner" /> Building text…</> : "Download .txt"}
        </button>
      </div>
      <div className="exp-plaintext">
        <button className="exp-copy-btn" onClick={() => void copyPlainText()} disabled={busy}>
          ⧉ Copy as plain text
        </button>
        <span className="exp-plaintext-note">For pasting into an application form (Workday, Greenhouse…). Free, doesn’t use a download.</span>
      </div>
    </motion.div>
  );
}
