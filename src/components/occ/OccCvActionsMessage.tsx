"use client";

import { useState } from "react";
import type { CVData } from "@/lib/cv/schema";
import { OccVersionedCv } from "./OccVersionedCv";
import { OccTemplatePreview } from "./OccTemplatePreview";

/** In-thread, opt-in access to existing safe structured CV edit/preview flows.
 * It never applies text from an AI recommendation to a stored CV silently.
 */
export function OccCvActionsMessage({ document }: {
  document: { id: string; title: string; template: string; data: CVData } | null;
}) {
  const [versionOpen, setVersionOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  return <section aria-label="CV revision and template actions" className="occ2-cv-actions-message">
    <p className="occ2-review-kicker">CV Improvement · Career Copilot</p>
    <h3>Choose your next step</h3>
    <p>Review your wording in this conversation. To create a saved CV version, select the exact field, compare before and after, then explicitly approve the change.</p>
    <details className="occ2-cv-action-details" onToggle={event => setVersionOpen(event.currentTarget.open)}>
      <summary>Save an approved revision as a new CV version</summary>
      <div className="occ2-cv-action-body">
        {versionOpen && <OccVersionedCv />}
      </div>
    </details>
    <details className="occ2-cv-action-details" onToggle={event => setPreviewOpen(event.currentTarget.open)}>
      <summary>Preview a saved CV in an Orire template</summary>
      <div className="occ2-cv-action-body">
        {previewOpen && <OccTemplatePreview document={document} />}
      </div>
    </details>
    <p className="occ2-review-note">Creating a version never overwrites or activates your source CV. Template previews are read-only. Pasted CV text must first be converted into a structured CV with your approval.</p>
  </section>;
}
