"use client";

import { useState } from "react";
import { sampleCV } from "@/lib/cv/sample";

/** A genuine fictional Word sample, using the same generator as Studio. */
export function PublicWordSample() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function download() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const { exportCVtoDocx } = await import("@/lib/export/docx");
      const ok = await exportCVtoDocx("Orire — fictional CV sample", sampleCV);
      if (!ok) setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={download} disabled={busy} aria-busy={busy}>
        {busy ? "Preparing fictional Word sample…" : "Download fictional Word (.docx) sample"}
      </button>
      {error && <p role="alert">Could not generate the sample. Please try again.</p>}
      <p>This file contains fictional details and demonstrates Orire&apos;s editable, single-column Word export. Word does not reproduce the decorative PDF template layout.</p>
    </div>
  );
}
