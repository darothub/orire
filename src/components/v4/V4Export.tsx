"use client";

import Link from "next/link";
import { useState } from "react";
import { useCVStore } from "@/lib/store/cvStore";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { useUsageStore } from "@/lib/store/usageStore";
import { FONT_OPTIONS, SIZE_STEPS, useStyleStore, type CVAlign } from "@/lib/store/styleStore";
import { PAGE_MODES } from "@/lib/cv/page";
import { getTemplateInfo } from "@/lib/templates/catalog";
import { useCvExport, type ExportFormat } from "@/lib/export/useCvExport";
import { useHydrated } from "@/lib/v4/useHydrated";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { V4Shell } from "./V4Shell";
import { V4Paper } from "./V4Paper";
import { V4_LIBRARY_HREF, V4_STUDIO_HREF } from "@/lib/v4/nav";

const ALIGNS: { id: CVAlign; label: string }[] = [
  { id: "left", label: "Left" },
  { id: "justify", label: "Justify" },
  { id: "right", label: "Right" },
];

const BUSY_LABEL: Record<ExportFormat, string> = { pdf: "Building PDF…", docx: "Building Word…", txt: "Building text…" };

/** Export: preview the CV, then download it as PDF, Word or text, or share a link. */
export function V4Export() {
  const hydrated = useHydrated();
  const cv = useCVStore((s) => s.cv);
  const started = useCVStore((s) => s.started);
  const templateId = useCVStore((s) => s.activeTemplate);
  const x = useCvExport();
  const downloads = useUsageStore((s) => s.summary?.metrics.download);

  const fontId = useStyleStore((s) => s.fontId);
  const size = useStyleStore((s) => s.size);
  const align = useStyleStore((s) => s.align);
  const setFont = useStyleStore((s) => s.setFont);
  const setSize = useStyleStore((s) => s.setSize);
  const setAlign = useStyleStore((s) => s.setAlign);
  const resetStyle = useStyleStore((s) => s.resetStyle);

  const label = (f: ExportFormat, idle: string) => (x.busyFormat === f ? BUSY_LABEL[f] : idle);
  const person = cv.basics.fullName.trim();

  return (
    <V4Shell active="export" label="Export">
      <div className="v4-scroll">
        <header className="v4-head">
          <h1>Export</h1>
          <p>Send this CV anywhere. Check the preview, then pick a format.</p>
        </header>

        {hydrated && !started ? (
          <div className="v4-empty-state">
            <b>No CV to export yet</b>
            <p>Create or import your CV in the studio first.</p>
            <Link href={V4_STUDIO_HREF} className="v4-link">Open CV Studio</Link>
          </div>
        ) : (
          <div className="v4-exp">
            <div className="v4-exp-main">
              <Card pad className="v4-fmt">
                <div className="v4-fmt-text">
                  <b>PDF</b>
                  <p>ATS-safe: the page carries a hidden text layer so applicant systems can read it.</p>
                  <Toggle checked={x.embedData} onChange={x.setEmbedData} label="Include re-import data" />
                  <p className="v4-hint">
                    {x.embedData
                      ? "Lets you load this exact PDF back into Orire later with nothing lost. The full CV data travels invisibly inside the file. Turn it off before sending to someone who shouldn’t hold it."
                      : "This PDF won’t carry your full CV data. Re-importing it later uses the normal parser instead."}
                  </p>
                </div>
                <Button variant="gold" onClick={() => void x.doExport("pdf")} disabled={x.busy}>{label("pdf", "Download PDF")}</Button>
              </Card>

              <Card pad className="v4-fmt">
                <div className="v4-fmt-text">
                  <b>Word (.docx)</b>
                  <p>One clean column built from your content. Easy for a recruiter to edit, not a visual copy of the template.</p>
                </div>
                <Button variant="ghost" onClick={() => void x.doExport("docx")} disabled={x.busy}>{label("docx", "Download .docx")}</Button>
              </Card>

              <Card pad className="v4-fmt">
                <div className="v4-fmt-text">
                  <b>Plain text</b>
                  <p>Paste into an application form (Workday, Greenhouse), or download a .txt. Copying is free and never uses a download.</p>
                </div>
                <div className="v4-fmt-btns">
                  <Button variant="ghost" onClick={() => void x.copyPlainText()} disabled={x.busy}>Copy text</Button>
                  <Button variant="ghost" onClick={() => void x.doExport("txt")} disabled={x.busy}>{label("txt", "Download .txt")}</Button>
                </div>
              </Card>

              {x.msg && <p className={`v4-msg ${x.msg.kind}`} role="status">{x.msg.text}</p>}
              {x.gate.ready && !x.gate.allowed && !x.msg && <p className="v4-msg err" role="status">{x.gate.reason}</p>}

              <Card pad className="v4-layout">
                <h2>Layout</h2>
                <div className="v4-fields">
                  <label>
                    <span>Font</span>
                    <select value={fontId} onChange={(e) => setFont(e.target.value)}>
                      {FONT_OPTIONS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Text size · {Math.round(size * 100)}%</span>
                    <input
                      type="range" min={0} max={SIZE_STEPS.length - 1} step={1}
                      value={Math.max(0, SIZE_STEPS.indexOf(size as (typeof SIZE_STEPS)[number]))}
                      onChange={(e) => setSize(SIZE_STEPS[Number(e.target.value)])}
                    />
                  </label>
                </div>
                <span className="v4-sublabel">Alignment</span>
                <div className="v4-seg" role="group" aria-label="Alignment">
                  {ALIGNS.map((a) => (
                    <button key={a.id} type="button" className={align === a.id ? "on" : ""} aria-pressed={align === a.id} onClick={() => setAlign(a.id)}>{a.label}</button>
                  ))}
                </div>
                <span className="v4-sublabel">PDF pages</span>
                <div className="v4-seg" role="group" aria-label="PDF page layout">
                  {PAGE_MODES.map((m) => (
                    <button key={m.id} type="button" className={x.mode === m.id ? "on" : ""} aria-pressed={x.mode === m.id} title={m.hint} onClick={() => x.setMode(m.id)}>{m.label}</button>
                  ))}
                </div>
                <p className="v4-hint">Page layout applies to the PDF only. Word always uses one standard column.</p>
                <button type="button" className="v4-link" onClick={resetStyle}>Reset styling</button>
              </Card>

              <Card pad className="v4-layout">
                <h2>File details</h2>
                <div className="v4-fields">
                  <label><span>File name</span><input value={x.fileName} onChange={(e) => x.setFileName(e.target.value)} spellCheck={false} placeholder={x.defaultName} /></label>
                  <label><span>Company (for the library)</span><input value={x.company} onChange={(e) => x.setCompany(e.target.value)} spellCheck={false} placeholder="e.g. Acme Corp" /></label>
                </div>
              </Card>

              {hydrated && <UsageCard usage={downloads} />}
              {hydrated && <ShareCard />}
            </div>

            <aside className="v4-exp-preview" aria-label="CV preview">
              {hydrated && (
                <>
                  <div className="v4-exp-meta">
                    <b>{person || "Your CV"}</b>
                    <span>{getTemplateInfo(templateId)?.name ?? templateId}</span>
                  </div>
                  <V4Paper cv={cv} templateId={templateId} id="cv-paper" styled />
                </>
              )}
            </aside>
          </div>
        )}
      </div>
    </V4Shell>
  );
}

function UsageCard({ usage }: { usage: { used: number; cap: number | null; scope: "lifetime" | "monthly" } | undefined }) {
  if (!usage) return null;
  const pct = usage.cap ? Math.min(100, Math.round((usage.used / usage.cap) * 100)) : 0;
  return (
    <Card pad className="v4-usage">
      <div className="v4-usage-row">
        <b>Downloads</b>
        <span>
          {usage.cap === null
            ? "Unlimited on your plan"
            : `${usage.used} of ${usage.cap} ${usage.scope === "monthly" ? "this month" : "free downloads"} used`}
        </span>
      </div>
      {usage.cap !== null && (
        <div className="v4-meter" role="meter" aria-label="Downloads used" aria-valuemin={0} aria-valuemax={usage.cap} aria-valuenow={usage.used}>
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
      <p className="v4-hint">Copying text never counts. <Link href="/pricing" className="v4-link">See plans</Link></p>
    </Card>
  );
}

function ShareCard() {
  const cloud = useLibraryStore((s) => s.cloud);
  const activeId = useLibraryStore((s) => s.activeId);
  const version = useLibraryStore((s) => s.versions.find((v) => v.id === s.activeId));
  const share = useLibraryStore((s) => s.share);
  const unshare = useLibraryStore((s) => s.unshare);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const url = version?.shareToken ? `${window.location.origin}/cv/${version.shareToken}` : "";

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setNote("Link copied");
    } catch {
      setNote("Couldn’t copy. Select the link and copy it.");
    }
  }
  async function create() {
    if (!activeId) return;
    setBusy(true);
    const token = await share(activeId);
    setBusy(false);
    if (token) await copy(`${window.location.origin}/cv/${token}`);
    else setNote("Couldn’t create a link. Check you are signed in and try again.");
  }

  return (
    <Card pad className="v4-layout">
      <h2>Share link</h2>
      <p className="v4-hint">A read-only web page of the active version. Search engines don’t index it, and you can turn it off at any time.</p>
      {!cloud ? (
        <p className="v4-hint">Sign in to share your CV as a link.</p>
      ) : !version ? (
        <p className="v4-hint">Save this CV as a version to share it. <Link href={V4_LIBRARY_HREF} className="v4-link">Open the library</Link></p>
      ) : url ? (
        <div className="v4-share">
          <input readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
          <Button variant="ghost" onClick={() => void copy(url)}>Copy link</Button>
          <Button variant="ghost" onClick={() => { void unshare(version.id); setNote("Share link turned off"); }}>Turn off</Button>
          <span className="v4-tag shared">Link is on</span>
        </div>
      ) : (
        <div><Button variant="ghost" onClick={() => void create()} disabled={busy}>Create share link</Button></div>
      )}
      <p className="v4-vc-note" role="status">{note}</p>
    </Card>
  );
}
