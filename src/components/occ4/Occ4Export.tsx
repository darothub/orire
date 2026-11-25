"use client";

import { useState } from "react";
import { CopilotCard } from "@/components/ui/CopilotCard";
import { Button } from "@/components/ui/Button";

type Kind = "pdf" | "docx" | "copy";

const Spark = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--or-violet)" strokeWidth="2" aria-hidden>
    <path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.5 5.7 21l2.3-7.1-6-4.5h7.6z" />
  </svg>
);

/**
 * In-chat export of the working draft: PDF (a pixel-true snapshot of the current
 * template), Word (a clean ATS-friendly file built from content), or copy as
 * plain text for an application form. Runs the studio's own export functions.
 */
export function Occ4Export({ onPdf, onDocx, onCopy }: {
  onPdf: () => Promise<boolean>;
  onDocx: () => Promise<boolean>;
  onCopy: () => Promise<boolean>;
}) {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [done, setDone] = useState<Kind | null>(null);
  const [err, setErr] = useState("");

  async function run(kind: Kind, fn: () => Promise<boolean>) {
    if (busy) return;
    setBusy(kind); setErr(""); setDone(null);
    try {
      const ok = await fn();
      if (ok) setDone(kind);
      else setErr("That export didn't complete — try again.");
    } catch {
      setErr("That export didn't complete — try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <CopilotCard title="Export" icon={<Spark />}>
      <p className="occ4-advice-summary">Download your working draft, or copy it as plain text for an application form.</p>
      <div className="occ4-export-actions">
        <Button variant="gold" size="sm" disabled={!!busy} onClick={() => void run("pdf", onPdf)}>
          {busy === "pdf" ? "Exporting…" : done === "pdf" ? "PDF ✓" : "PDF"}
        </Button>
        <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => void run("docx", onDocx)}>
          {busy === "docx" ? "Exporting…" : done === "docx" ? "Word ✓" : "Word (.docx)"}
        </Button>
        <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => void run("copy", onCopy)}>
          {busy === "copy" ? "Copying…" : done === "copy" ? "Copied ✓" : "Copy as text"}
        </Button>
      </div>
      {err && <p className="occ4-disclaimer" style={{ color: "var(--or-gap)" }}>{err}</p>}
      <p className="occ4-disclaimer">
        The PDF is a pixel-true snapshot of your current template; Word is a clean, single-column
        ATS-friendly file built from your content.
      </p>
    </CopilotCard>
  );
}
