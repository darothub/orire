"use client";

/**
 * Shared presentation bits for the CV-import flows (RebrandFlow + SourcesStep):
 * the file-size formatter and the small summary-chip components, which were
 * duplicated identically in both, plus the "check this" confidence-notes
 * callout shared by both review steps (P1-7).
 */

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function Chip({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return <span className="imp-kv"><em>{label}</em>{value}</span>;
}

export function Stat({ label, n }: { label: string; n: number }) {
  return <span className={`imp-kv ${n === 0 ? "zero" : ""}`}><em>{label}</em>{n}</span>;
}

/**
 * The "check this" review step (P1-7): the parser never invents a value, but it
 * can miss or mis-split a field it should have found. These are its own
 * confidence notes about this specific import — surfaced so the user checks
 * exactly the right fields instead of discovering a bad import after the fact.
 */
export function ImportNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="imp-notes">
      <strong>⚠ Check this before you continue</strong>
      <ul>{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
    </div>
  );
}
