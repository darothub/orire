"use client";

import { getTemplate } from "@/components/templates/registry";
import { publicSampleCV } from "@/lib/cv/publicSample";

/**
 * Render the real CV design, not a color swatch. This is a fictional, inert
 * illustration: it must not expose CV links or editing controls to visitors.
 */
export function TemplateDetailPreview({ id, name }: { id: string; name: string }) {
  const Template = getTemplate(id).Component;

  return (
    <div className="tpl-detail-preview" role="region" aria-label={`Fictional CV example in the ${name} template`}>
      <div className="tpl-detail-preview-window" aria-hidden="true" inert>
        <div className="paper tpl-detail-preview-paper">
          <Template cv={publicSampleCV} />
        </div>
      </div>
      <p className="sr-only">Example candidate: {publicSampleCV.basics.fullName}, {publicSampleCV.basics.title}. {publicSampleCV.basics.summary}</p>
      <p className="tpl-detail-preview-caption">Illustrative preview with fictional CV information</p>
    </div>
  );
}
