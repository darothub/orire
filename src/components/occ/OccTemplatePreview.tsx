"use client";

import { useEffect, useRef, useState } from "react";
import type { CVData } from "@/lib/cv/schema";
import { getTemplate, TEMPLATES } from "@/components/templates/registry";

/**
 * Read-only template rendering of an existing structured Orire CV. Selecting a
 * template never updates the library document or the active editor template.
 * Pasted/plain-text CVs are not converted to a fabricated structured preview.
 */
export function OccTemplatePreview({ document }: {
  document: { id: string; title: string; template: string; data: CVData } | null;
}) {
  const [chosen, setChosen] = useState<{ documentId: string; template: string } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!expanded) return;
    closeRef.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setExpanded(false);
        triggerRef.current?.focus();
      }
      if (event.key === "Tab") {
        // A closed preview has a single keyboard action; do not tab into the
        // underlying private conversation while the dialog is active.
        event.preventDefault();
        closeRef.current?.focus();
      }
    }
    window.document.addEventListener("keydown", handleKey);
    return () => window.document.removeEventListener("keydown", handleKey);
  }, [expanded]);
  if (!document) {
    return <p className="occ2-rail-note">Choose a saved Orire CV to preview it in an actual template. Uploaded or pasted plain text cannot be rendered as a structured CV without conversion and your approval.</p>;
  }
  const templateId = chosen?.documentId === document.id ? chosen.template : document.template;
  const template = getTemplate(templateId);
  const Renderer = template.Component;
  return <section aria-label="CV template preview" className="occ2-preview-section">
    <label htmlFor="occ2-preview-template">Preview template</label>
    <select id="occ2-preview-template" value={template.id}
      onChange={event => setChosen({ documentId: document.id, template: event.target.value })}>
      {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}{t.ats ? " · Single column" : " · Design"}</option>)}
    </select>
    <p className="occ2-rail-note">Previewing {document.title}. This does not change or save your CV.</p>
    <button ref={triggerRef} type="button" className="occ2-template-link" onClick={() => setExpanded(true)}>Open full CV preview</button>
    {expanded && <div className="occ2-preview-overlay" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) setExpanded(false);
    }}>
      <section role="dialog" aria-modal="true" aria-label={"Preview " + document.title} className="occ2-preview-dialog">
        <header>
          <div><strong>{document.title}</strong><span>{template.name} · Read-only preview</span></div>
          <button type="button" ref={closeRef} onClick={() => { setExpanded(false); triggerRef.current?.focus(); }} aria-label="Close CV template preview">Close ×</button>
        </header>
        <div className="occ2-preview-scroll">
          <div className="paper occ2-preview-page"><Renderer cv={document.data} /></div>
        </div>
      </section>
    </div>}
  </section>;
}
