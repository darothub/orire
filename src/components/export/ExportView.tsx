"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { useHistoryStore, PAGE_MODES, type PageMode } from "@/lib/store/historyStore";
import {
  useStyleStore,
  FONT_OPTIONS,
  SIZE_STEPS,
  type CVAlign,
} from "@/lib/store/styleStore";
import { getTemplate } from "@/components/templates/registry";
import { exportCVtoPDF } from "@/lib/export/pdf";
import { useWriteGate } from "@/lib/store/accountStore";

const ALIGNS: { id: CVAlign; label: string; icon: string }[] = [
  { id: "left", label: "Left", icon: "⇤" },
  { id: "justify", label: "Justify", icon: "≡" },
  { id: "right", label: "Right", icon: "⇥" },
];

export function ExportView() {
  const cv = useCVStore((s) => s.cv);
  const active = useCVStore((s) => s.activeTemplate);
  const add = useHistoryStore((s) => s.add);
  const lastCompany = useHistoryStore((s) => s.lastCompany);

  const fontId = useStyleStore((s) => s.fontId);
  const size = useStyleStore((s) => s.size);
  const align = useStyleStore((s) => s.align);
  const setFont = useStyleStore((s) => s.setFont);
  const setSize = useStyleStore((s) => s.setSize);
  const setAlign = useStyleStore((s) => s.setAlign);
  const resetStyle = useStyleStore((s) => s.resetStyle);

  const person = cv.basics.fullName.trim();
  const tpl = getTemplate(active);
  const defaultName = useMemo(() => (person ? `${person} — CV` : "orire — CV"), [person]);

  const [fileName, setFileName] = useState(defaultName);
  const [company, setCompany] = useState(lastCompany);
  const [mode, setMode] = useState<PageMode>("paged");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const gate = useWriteGate("download your CV");

  const doExport = async () => {
    if (!gate.guard()) {
      setMsg({ kind: "err", text: gate.reason ?? "Verify your email to download." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const ok = await exportCVtoPDF(mode, fileName || defaultName, cv);
      if (!ok) {
        setMsg({ kind: "err", text: "Couldn’t find the live CV to export. Try again." });
        return;
      }
      add({
        fileName: (fileName.trim() || defaultName),
        company: company.trim(),
        person,
        template: active,
        templateName: tpl.name,
        mode,
        cv,
      });
      setMsg({ kind: "ok", text: `Saved “${(fileName.trim() || defaultName)}.pdf” · filed under ${company.trim() || "Unfiled"} in History.` });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

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
          <h2>Export</h2>
          <p>Style the CV, pick a page layout, and download a PDF straight from here — the live preview on the right updates as you go.</p>
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
        <h4 className="exp-sec-title">Page layout</h4>
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
        <button className="flow-btn primary lg" onClick={() => void doExport()} disabled={busy}>
          {busy ? <><span className="cmp-spinner" /> Building PDF…</> : "Download PDF"}
        </button>
      </div>
    </motion.div>
  );
}
