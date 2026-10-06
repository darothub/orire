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
import { useWriteGate } from "@/lib/store/accountStore";
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
  const gate = useWriteGate("download the cover letter");

  async function doExport() {
    if (!letter) return;
    if (!gate.guard()) return;
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
 * Template-matched letter sheet with a full, per-template letterhead. Themed
 * templates reuse the real `.r-header` DOM (so banners, rules, centering, caps
 * replicate exactly); the four bespoke templates each get a letterhead that
 * mirrors their own identity (Aurora spine, Noir gold kicker, Meridian Swiss
 * split, Vertex gradient band + avatar).
 */

function contactSpans(cv: CVData) {
  return [cv.basics.location, cv.basics.email, cv.basics.phone]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .map((c, i) => <span key={i}>{c}</span>);
}

function CoverLetterSheet({ letter, cv, templateId }: { letter: CoverLetter; cv: CVData; templateId: string }) {
  const name = cv.basics.fullName || "Your Name";
  const title = cv.basics.title;
  const greeting = letter.meta.hiringManager?.trim()
    ? `Dear ${letter.meta.hiringManager.trim()},`
    : "Dear Hiring Team,";
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const body = (
    <>
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
        <span className="cl-sign-name">{name}</span>
      </p>
    </>
  );

  // Bespoke letterheads — each mirrors its template's signature header.
  if (templateId === "aurora") {
    return (
      <article id="cl-paper" className="aurora cl-paper cl-aurora">
        <header className="au-header">
          <h1 className="au-name">{name}</h1>
          {title ? <p className="au-title">{title}</p> : null}
          <div className="au-contact">{contactSpans(cv)}</div>
        </header>
        <div className="au-main cl-body">{body}</div>
      </article>
    );
  }
  if (templateId === "noir") {
    return (
      <article id="cl-paper" className="noir cl-paper cl-noir">
        <header className="nr-header">
          <span className="nr-kicker">Cover Letter</span>
          <h1 className="nr-name">{name}</h1>
          {title ? <p className="nr-title">{title}</p> : null}
          <div className="nr-contact">{contactSpans(cv)}</div>
        </header>
        <div className="nr-body cl-body">{body}</div>
      </article>
    );
  }
  if (templateId === "meridian") {
    return (
      <article id="cl-paper" className="meridian cl-paper cl-meridian">
        <header className="md-header">
          <div>
            <h1 className="md-name">{name}</h1>
            {title ? <p className="md-role">{title}</p> : null}
          </div>
          <div className="md-contact">{contactSpans(cv)}</div>
        </header>
        <div className="md-body cl-body">{body}</div>
      </article>
    );
  }
  if (templateId === "vertex") {
    const initials = name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
    return (
      <article id="cl-paper" className="cl-paper cl-vertex">
        <header className="vxl-head">
          <div className="vx-avatar">{initials}</div>
          <div className="vxl-id">
            <h1 className="vxl-name">{name}</h1>
            {title ? <p className="vxl-title">{title}</p> : null}
          </div>
          <div className="vxl-contact">{contactSpans(cv)}</div>
        </header>
        <div className="cl-body cl-vertex-body">{body}</div>
      </article>
    );
  }

  // Themed templates — reuse the authentic Resume header DOM + theme class.
  return (
    <article id="cl-paper" className={`resume t-${templateId} lay-single cl-paper cl-themed`}>
      <header className="r-header">
        <h1 className="r-name">{name}</h1>
        {title ? <p className="r-title">{title}</p> : null}
        <div className="r-contact">{contactSpans(cv)}</div>
      </header>
      <div className="r-main cl-body">{body}</div>
    </article>
  );
}
