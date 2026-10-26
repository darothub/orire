"use client";

import { useState } from "react";
import { publicSampleCV } from "@/lib/cv/publicSample";

/** A genuine fictional Word sample, using the same generator as Studio. */
export function PublicWordSample({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function download() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const { exportCVtoDocx } = await import("@/lib/export/docx");
      const ok = await exportCVtoDocx("Orire — fictional CV sample", publicSampleCV);
      if (!ok) setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="public-word-sample">
      <button className="public-export-button" type="button" onClick={download} disabled={busy} aria-busy={busy} aria-label={busy ? "Preparing Word…" : compact ? "Sample Word — download fictional CV (.docx)" : "Download fictional Word (.docx) sample"}>
        {busy ? "Preparing Word…" : compact ? "Sample Word" : "Download fictional Word (.docx) sample"}
      </button>
      {error && <p role="alert">Could not generate the sample. Please try again.</p>}
      {!compact && <p>This file contains fictional details and demonstrates Orire&apos;s editable, single-column Word export. Word does not reproduce the decorative PDF template layout.</p>}
    </div>
  );
}
