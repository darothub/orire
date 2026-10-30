"use client";
import { useState } from "react";
import Link from "next/link";
import { getTemplate, isAtsSafe } from "@/components/templates/registry";
import { sampleCV } from "@/lib/cv/sample";
import "./preview.css";

const FEATURED = ["aurora", "meridian", "slate", "ivory", "oxford", "verde"] as const;
export default function OrireDesignPreview() {
  const [selected, setSelected] = useState<string>("aurora");
  const [zoom, setZoom] = useState(0.5);
  const [expanded, setExpanded] = useState(false);
  const template = getTemplate(selected);
  const Template = template.Component;
  return <main className="orire2-preview">
    <div className="orire2-ribbon">ORIRE 2.0 · DESIGN REVIEW ONLY · Fictional CV · No account or billing actions</div>
    <div className="orire2-shell">
      <div className="orire2-topline"><Link href="/templates">← Existing template gallery</Link><span>Demo 01 / Real renderer</span></div>
      <header className="orire2-intro">
        <p className="orire2-eyebrow">Your experience. Your presentation.</p>
        <h1>One CV. Six distinct designs.</h1>
        <p>Switch between Orire’s actual React templates while keeping the same sample content. Read-only design review; not an ATS evaluation.</p>
      </header>
      <div className="orire2-picks" role="group" aria-label="Select CV template">
        {FEATURED.map(id => { const t = getTemplate(id); return <button type="button" key={id} className={selected === id ? "orire2-choice selected" : "orire2-choice"} aria-pressed={selected === id} onClick={() => setSelected(id)}>
          <span className="orire2-swatch" style={{background:t.swatch}} aria-hidden="true" /><strong>{t.name}</strong><small>{t.blurb}</small>
        </button>; })}
      </div>
      <section className="orire2-stage" aria-label={template.name + " resume preview"}>
        <div className="orire2-toolbar"><div><strong>{template.name}</strong><span className="orire2-type">{isAtsSafe(selected) ? "Single-column" : "Design layout"}</span></div>
          <div className="orire2-tools"><label htmlFor="orire2-zoom">Zoom</label>
            <select id="orire2-zoom" value={zoom} onChange={e => setZoom(Number(e.target.value))}>
              <option value={0.5}>50%</option><option value={0.66}>66%</option><option value={0.85}>85%</option><option value={1}>100%</option>
            </select>
            <button type="button" aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Collapse preview" : "Expand preview"}</button>
          </div>
        </div>
        <div className={expanded ? "orire2-canvas expanded" : "orire2-canvas"}>
          <div className="orire2-sheet-frame" style={{width:794 * zoom, minHeight:1123 * zoom}}>
            <div className="paper orire2-sheet" style={{transform:"scale(" + zoom + ")"}}><Template cv={sampleCV} /></div>
          </div>
        </div>
        <p className="orire2-note">Actual Orire renderer with fictional Ada Okonkwo sample. No CV changes are saved. On narrow screens, scroll inside the preview to inspect the page.</p>
      </section>
    </div>
  </main>;
}
