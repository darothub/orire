"use client";

import type { CVData } from "@/lib/cv/schema";
import { cvFieldChoices, type CvField } from "@/lib/occ/versionPatch";

/**
 * Inline edit view for the working draft: every editable field (summary and
 * each experience/project bullet) as a text box. Uncontrolled — an edit saves
 * to the draft (via onEdit) on blur, so coverage and the template preview pick
 * it up without fighting the cursor on every keystroke.
 */
export function Occ4Editor({ cv, onEdit }: { cv: CVData; onEdit: (field: CvField, text: string) => void }) {
  const fields = cvFieldChoices(cv);
  if (fields.length === 0) {
    return <p className="occ4-pv-empty">This draft has no editable summary or bullets yet.</p>;
  }
  return (
    <div className="occ4-editor">
      <p className="occ4-editor-hint">Edit any line — changes save to your working draft when you click away.</p>
      {fields.map((f, i) => (
        <label className="occ4-editor-field" key={i}>
          <span>{f.label}</span>
          <textarea
            defaultValue={f.text}
            rows={f.field.kind === "summary" ? 4 : 2}
            onBlur={(e) => {
              const v = e.target.value;
              if (v.trim() && v.trim() !== f.text.trim()) onEdit(f.field, v);
            }}
          />
        </label>
      ))}
    </div>
  );
}
