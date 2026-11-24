"use client";

import { useState } from "react";
import { TEMPLATE_CATALOG } from "@/lib/templates/catalog";
import { isAtsSafe } from "@/components/templates/registry";
import { CopilotCard } from "@/components/ui/CopilotCard";

const Spark = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--or-violet)" strokeWidth="2" aria-hidden>
    <path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.5 5.7 21l2.3-7.1-6-4.5h7.6z" />
  </svg>
);

/**
 * Template picker for the working draft. Picking one restyles the draft live in
 * the preview via onPick — the same catalog + registry the editor and the public
 * gallery use, so there is one source of templates. "Single column" marks the
 * ATS-parse-safe layouts.
 */
export function Occ4Templates({ current, onPick }: { current: string; onPick: (id: string) => void }) {
  const [sel, setSel] = useState(current);
  return (
    <CopilotCard title="Templates" icon={<Spark />}>
      <p className="occ4-advice-summary">
        Pick a template — your working draft restyles instantly in the preview. &ldquo;Single column&rdquo;
        templates stay ATS-parse-safe.
      </p>
      <div className="occ4-tpl-grid">
        {TEMPLATE_CATALOG.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`occ4-tpl${sel === t.id ? " on" : ""}`}
            aria-pressed={sel === t.id}
            onClick={() => { setSel(t.id); onPick(t.id); }}
          >
            <span className="occ4-tpl-sw" style={{ background: t.swatch }} />
            <b>{t.name}</b>
            <span className="occ4-tpl-blurb">{t.blurb}</span>
            <span className="occ4-tpl-ats">{isAtsSafe(t.id) ? "Single column" : "Design"}</span>
          </button>
        ))}
      </div>
    </CopilotCard>
  );
}
