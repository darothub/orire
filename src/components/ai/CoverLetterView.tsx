"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useCoverLetterStore } from "@/lib/store/coverLetterStore";
import { useCVStore } from "@/lib/store/cvStore";
import { useViewStore } from "@/lib/store/viewStore";
import { usePlanStore } from "@/lib/store/planStore";
import { getTemplate } from "@/components/templates/registry";
import { AutoTextarea } from "@/components/editor/AutoTextarea";
import { exportCoverLetterToPDF } from "@/lib/export/coverLetterPdf";
import { allowCoverLetter, nextPlan } from "@/lib/plan/plan";
import { PROVIDERS } from "@/lib/ai/types";
import type { CoverLetter } from "@/lib/cv/coverLetter";
import type { CVData } from "@/lib/cv/schema";
import type { CoverLetterTone } from "@/lib/ai/coverLetter";

const TONES: { id: CoverLetterTone; label: string }[] = [
  { id: "professional", label: "Professional" },
  { id: "warm", label: "Warm" },
  { id: "confident", label: "Confident" },
  { id: "concise", label: "Concise" },
];

function contactLine(cv: CVData): string {
  return [cv.basics.email, cv.basics.phone, cv.basics.location]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join("  ·  ");
}

export function CoverLetterView() {
  const plan = usePlanStore((s) => s.plan);
  const setView = useViewStore((s) => s.setView);
  const cv = useCVStore((s) => s.cv);
  const activeTemplate = useCVStore((s) => s.activeTemplate);

  const phase = useCoverLetterStore((s) => s.phase);
  const letter = useCoverLetterStore((s) => s.letter);
  const error = useCoverLetterStore((s) => s.error);
  const provider = useCoverLetterStore((s) => s.provider);
  const tone = useCoverLetterStore((s) => s.tone);
  const setTone = useCoverLetterStore((s) => s.setTone);
  const run = useCoverLetterStore((s) => s.runCoverLetter);

  const [exporting, setExporting] = useState(false);
  const allowed = allowCoverLetter(plan);
  const running = phase === "running";

  async function doExport() {
    if (!letter) return;
    setExporting(true);
    try {
      await exportCoverLetterToPDF(
        `${cv.basics.fullName || "cover"}-cover-letter`,
        letter,
        cv.basics.fullName,
        cv.basics.title,
        contactLine(cv),
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <motion.div
      className="ws-view cl-view"
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ws-head">
        <div>
          <h2>Cover letter</h2>
          <p>
            Edit on the left, preview on the right — matched to your{" "}
            <strong>{getTemplate(activeTemplate).name}</strong> template. Grounded in your CV facts.
            {provider && phase === "done" ? ` Drafted by ${PROVIDERS[provider].label}.` : ""}
          </p>
        </div>
        <div className="cl-head-actions">
          <button className="flow-btn ghost sm" onClick={() => setView("refine")}>← Back to Refine</button>
          {allowed && letter && (
            <button className="btn-primary" onClick={() => void doExport()} disabled={exporting}>
              {exporting ? "Exporting…" : "Export PDF"}
            </button>
          )}
        </div>
      </div>

      {!allowed ? (
        <div className="cl-gate">
          <strong>Cover letters are a {nextPlan("free")?.label ?? "Pro"} feature.</strong>
          <p>Upgrade to generate a tailored, editable cover letter from your CV.</p>
          <button className="flow-btn primary" onClick={() => setView("connect")}>See plans</button>
        </div>
      ) : (
        <>
          <div className="cl-toolbar">
            <label className="cl-tone">
              <span>Tone</span>
              <select value={tone} onChange={(e) => setTone(e.target.value as CoverLetterTone)}>
                {TONES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>
            <button className="flow-btn sm" onClick={() => void run()} disabled={running}>
              {running ? "Writing…" : letter ? "Regenerate" : "Generate"}
            </button>
          </div>

          {error && phase === "error" && (
            <div className="imp-error cl-err">
              <strong>{error.title}{error.status ? ` (HTTP ${error.status})` : ""}</strong>
              <pre>{error.body}</pre>
            </div>
          )}

          {!letter && !running && phase !== "error" && (
            <div className="cl-empty">
              <p>No cover letter yet. Pick a tone and generate one from your CV and the job description.</p>
              <button className="flow-btn primary" onClick={() => void run()}>Generate cover letter</button>
            </div>
          )}

          {letter && (
            <div className="cl-split">
              <CoverLetterEditor />
              <div className="cl-col">
                <div className="cl-col-head">
                  <span className="cl-col-tag">Preview</span>
                  <span className="cl-col-sub">{getTemplate(activeTemplate).name} · A4</span>
                </div>
                <div className="cl-paper-wrap">
                  <CoverLetterSheet letter={letter} cv={cv} templateId={activeTemplate} />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

function CoverLetterEditor() {
  const letter = useCoverLetterStore((s) => s.letter);
  const updateMeta = useCoverLetterStore((s) => s.updateMeta);
  const setOpening = useCoverLetterStore((s) => s.setOpening);
  const setClosing = useCoverLetterStore((s) => s.setClosing);
  const setSignoff = useCoverLetterStore((s) => s.setSignoff);
  const setParagraph = useCoverLetterStore((s) => s.setParagraph);
  const addParagraph = useCoverLetterStore((s) => s.addParagraph);
  const removeParagraph = useCoverLetterStore((s) => s.removeParagraph);
  const moveParagraph = useCoverLetterStore((s) => s.moveParagraph);
  if (!letter) return null;

  return (
    <div className="cl-col cl-editor">
      <div className="cl-col-head">
        <span className="cl-col-tag">Edit</span>
        <span className="cl-col-sub">Boxes grow to fit — no scrolling</span>
      </div>

      <div className="cl-fields">
        <div className="cl-meta-row">
          <label className="cl-field">
            <span>Role</span>
            <input value={letter.meta.role} onChange={(e) => updateMeta({ role: e.target.value })} placeholder="e.g. Backend Engineer" />
          </label>
          <label className="cl-field">
            <span>Company</span>
            <input value={letter.meta.company} onChange={(e) => updateMeta({ company: e.target.value })} placeholder="e.g. ScaleCorp" />
          </label>
        </div>
        <label className="cl-field">
          <span>Hiring manager (optional)</span>
          <input
            value={letter.meta.hiringManager ?? ""}
            onChange={(e) => updateMeta({ hiringManager: e.target.value || undefined })}
            placeholder="Leave blank for “Dear Hiring Team”"
          />
        </label>

        <label className="cl-field">
          <span>Opening</span>
          <AutoTextarea value={letter.opening} onChange={(e) => setOpening(e.target.value)} className="cl-ta" />
        </label>

        <div className="cl-field">
          <div className="cl-body-head">
            <span>Body paragraphs</span>
            <button className="flow-btn ghost sm" onClick={addParagraph}>+ Paragraph</button>
          </div>
          {letter.body.map((p, i) => (
            <div key={i} className="cl-para">
              <AutoTextarea value={p} onChange={(e) => setParagraph(i, e.target.value)} className="cl-ta" />
              <div className="cl-para-tools">
                <button title="Move up" onClick={() => moveParagraph(i, -1)} disabled={i === 0}>↑</button>
                <button title="Move down" onClick={() => moveParagraph(i, 1)} disabled={i === letter.body.length - 1}>↓</button>
                <button title="Remove" className="cl-del" onClick={() => removeParagraph(i)}>✕</button>
              </div>
            </div>
          ))}
        </div>

        <label className="cl-field">
          <span>Closing</span>
          <AutoTextarea value={letter.closing} onChange={(e) => setClosing(e.target.value)} className="cl-ta" />
        </label>
        <label className="cl-field cl-field-sm">
          <span>Sign-off</span>
          <input value={letter.signoff} onChange={(e) => setSignoff(e.target.value)} placeholder="Sincerely," />
        </label>
      </div>
    </div>
  );
}

/**
 * Template-matched letter sheet. It inherits the active template's theme tokens
 * (accent, ink, rule, display font) by carrying the same `resume t-<id>` class
 * the CV templates use, so the letter visually belongs with the CV.
 */
function CoverLetterSheet({ letter, cv, templateId }: { letter: CoverLetter; cv: CVData; templateId: string }) {
  const greeting = letter.meta.hiringManager?.trim()
    ? `Dear ${letter.meta.hiringManager.trim()},`
    : "Dear Hiring Team,";
  const contact = contactLine(cv);
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  return (
    <div id="cl-paper" className={`resume t-${templateId} cl-paper`}>
      <header className="cl-letterhead">
        <strong className="cl-name">{cv.basics.fullName || "Your Name"}</strong>
        {cv.basics.title ? <span className="cl-role">{cv.basics.title}</span> : null}
        {contact ? <span className="cl-contact">{contact}</span> : null}
      </header>
      <div className="cl-date">{today}</div>
      {(letter.meta.company || letter.meta.role) && (
        <div className="cl-recipient">
          {letter.meta.company ? <span>{letter.meta.company}</span> : null}
          {letter.meta.role ? <span>Re: {letter.meta.role}</span> : null}
        </div>
      )}
      <p className="cl-greeting">{greeting}</p>
      {letter.opening ? <p>{letter.opening}</p> : null}
      {letter.body.map((para, i) => (para.trim() ? <p key={i}>{para}</p> : null))}
      {letter.closing ? <p>{letter.closing}</p> : null}
      <p className="cl-sign">
        {letter.signoff || "Sincerely,"}
        <br />
        <span className="cl-sign-name">{cv.basics.fullName || "Your Name"}</span>
      </p>
    </div>
  );
}
