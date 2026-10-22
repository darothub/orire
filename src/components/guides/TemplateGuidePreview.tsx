"use client";

import { getTemplate } from "@/components/templates/registry";
import { sampleCV } from "@/lib/cv/sample";

/**
 * Genuine Orire CV renderer, not a color swatch or external mockup.
 * Each design is shown with the SAME fictional sampleCV. The miniature
 * document is inert: embedded portfolio/email links are not interactive.
 * Nearby visible text describes the choice for screen-reader visitors.
 */
export function TemplateGuidePreview({ id, name }: { id: string; name: string }) {
  const Template = getTemplate(id).Component;

  return (
    <div
      className="ux107-paper-wrap"
      role="img"
      aria-label={`Fictional Ada Okonkwo CV rendered in the real Orire ${name} template`}
    >
      <div className="ux107-paper-stage" aria-hidden="true" inert>
        <div className="paper ux107-paper-inner">
          <Template cv={sampleCV} />
        </div>
      </div>
    </div>
  );
}
