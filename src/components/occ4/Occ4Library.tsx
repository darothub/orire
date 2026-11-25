"use client";

import type { CVData } from "@/lib/cv/schema";
import { CopilotCard } from "@/components/ui/CopilotCard";
import { Button } from "@/components/ui/Button";

export type SavedDoc = {
  id: string;
  title: string;
  company: string | null;
  template: string;
  data: CVData;
  updatedAt: string;
};

const Spark = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--or-violet)" strokeWidth="2" aria-hidden>
    <path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.5 5.7 21l2.3-7.1-6-4.5h7.6z" />
  </svg>
);

/**
 * Your saved CV library, in chat. Opening a version loads it as the working
 * draft for this conversation (via onOpen) — the saved copy is untouched until
 * you save again. Closes the Save → retrieve loop.
 */
export function Occ4Library({ docs, onOpen }: { docs: SavedDoc[]; onOpen: (doc: SavedDoc) => void }) {
  return (
    <CopilotCard title="Your CV library" icon={<Spark />}>
      {docs.length === 0 ? (
        <p className="occ4-advice-summary">
          No saved CVs yet. Build one in the editor, or save a tailored draft from a conversation, and it&rsquo;ll
          show up here.
        </p>
      ) : (
        <div className="occ4-lib">
          {docs.map((d) => (
            <div className="occ4-lib-row" key={d.id}>
              <div className="occ4-lib-meta">
                <b>{d.title}</b>
                <span>
                  {[d.company, d.template].filter(Boolean).join(" · ")}
                  {" · "}
                  {new Date(d.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onOpen(d)}>Open</Button>
            </div>
          ))}
        </div>
      )}
      <p className="occ4-disclaimer">
        Opening a version loads it as your working draft here — your saved copy stays untouched until you save
        again.
      </p>
    </CopilotCard>
  );
}
