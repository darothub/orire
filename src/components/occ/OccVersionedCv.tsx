"use client";
import { useEffect, useState } from "react";
import type { CVData } from "@/lib/cv/schema";
import { type CvField, readCvField } from "@/lib/occ/versionPatch";

type Source = { id: string; title: string; company: string | null; template: string; updatedAt: string; data: CVData };
type Choice = { label: string; field: CvField; text: string };

function choices(cv: CVData): Choice[] {
  const options: Choice[] = [];
  if (cv.basics.summary.trim()) options.push({ label: "Professional summary", field: { kind: "summary" }, text: cv.basics.summary });
  for (const entry of cv.experience) {
    entry.highlights.forEach((text, index) => {
      if (text.trim()) options.push({ label: `${entry.company || "Experience"} · bullet ${index + 1}`, field: { kind: "experience", itemId: entry.id, index }, text });
    });
  }
  for (const entry of cv.projects) {
    entry.highlights.forEach((text, index) => {
      if (text.trim()) options.push({ label: `${entry.name || "Project"} · bullet ${index + 1}`, field: { kind: "project", itemId: entry.id, index }, text });
    });
  }
  return options;
}

/** Structured, opt-in CV revision. Never activates the new version automatically. */
export function OccVersionedCv() {
  const [documents, setDocuments] = useState<Source[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [fieldIndex, setFieldIndex] = useState(-1);
  const [replacement, setReplacement] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [save, setSave] = useState<{ id: string; undoId: string } | null>(null);
  const source = documents.find(doc => doc.id === sourceId);
  const available = source ? choices(source.data) : [];
  const selected = available[fieldIndex];
  const original = selected && source ? readCvField(source.data, selected.field) : null;
  const canSave = Boolean(original && replacement.trim().length >= 10 &&
    replacement.length <= 1500 && replacement.trim() !== original && !pending && !save);

  async function refresh() {
    setPending(true); setNotice("");
    try {
      const response = await fetch("/api/occ/versions", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load saved CV versions.");
      const data = await response.json();
      setDocuments(data.documents);
      setSourceId(""); setFieldIndex(-1); setReplacement(""); setSave(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load CV versions.");
    } finally { setPending(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function saveVersion() {
    if (!canSave || !source || !selected || original === null) return;
    setPending(true); setNotice("");
    try {
      const response = await fetch("/api/occ/versions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: source.id, expectedUpdatedAt: source.updatedAt,
          field: selected.field, expectedText: original, replacement,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save version.");
      setSave({ id: data.id, undoId: data.undoId });
      setNotice("New private version saved to your CV Library. Your original and active CV remain unchanged.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save version.");
    } finally { setPending(false); }
  }

  async function undo() {
    if (!save || !window.confirm("Delete the OCC-created version? Your original CV will remain intact.")) return;
    setPending(true); setNotice("");
    try {
      const response = await fetch(`/api/occ/versions/${encodeURIComponent(save.undoId)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not undo.");
      setSave(null);
      setNotice("OCC-created version deleted. Original CV unchanged.");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not undo.");
    } finally { setPending(false); }
  }

  const fieldStyle = { width: "100%", padding: 12, borderRadius: 10, border: "1px solid #c8c1d9", background: "transparent", color: "inherit" };
  return <section style={{ display: "grid", gap: 14, border: "1px solid #c8c1d9", borderRadius: 18, padding: 24 }}>
    <header>
      <h2 style={{ fontWeight: 750, fontSize: 23 }}>Save an approved CV revision</h2>
      <p style={{ opacity: .8 }}>Choose an existing saved CV and one specific field. Review the exact before/after wording, then create a new private version. No source CV is overwritten.</p>
    </header>
    <button type="button" disabled={pending} onClick={() => void refresh()} style={{ justifySelf: "start" }}>Refresh saved CVs</button>
    <label style={{ display: "grid", gap: 6 }}>Source CV
      <select value={sourceId} onChange={event => { setSourceId(event.target.value); setFieldIndex(-1); setReplacement(""); setSave(null); }} style={fieldStyle}>
        <option value="">Choose a saved CV</option>
        {documents.map(doc => <option key={doc.id} value={doc.id}>{doc.title}{doc.company ? ` · ${doc.company}` : ""}</option>)}
      </select>
    </label>
    {source && <label style={{ display: "grid", gap: 6 }}>Field to revise
      <select value={fieldIndex} onChange={event => { const index = Number(event.target.value); setFieldIndex(index); setReplacement(index >= 0 ? available[index]?.text ?? "" : ""); setSave(null); }} style={fieldStyle}>
        <option value={-1}>Choose summary or a bullet</option>
        {available.map((item, index) => <option value={index} key={index}>{item.label}</option>)}
      </select>
    </label>}
    {original !== null && original !== undefined && <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" }}>
      <label style={{ display: "grid", gap: 6 }}>Before (original)
        <textarea readOnly value={original} style={{ ...fieldStyle, minHeight: 145 }} />
      </label>
      <label style={{ display: "grid", gap: 6 }}>After (your approved wording)
        <textarea value={replacement} maxLength={1500} onChange={event => { setReplacement(event.target.value); setSave(null); }} style={{ ...fieldStyle, minHeight: 145 }} />
      </label>
    </div>}
    {source && <p style={{ fontSize: 13, opacity: .8 }}>Source last updated: {new Date(source.updatedAt).toLocaleString()}. OCC checks for newer edits when saving. Your new version inherits the existing template and is not activated automatically.</p>}
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <button type="button" disabled={!canSave} onClick={saveVersion}
        style={{ border: 0, padding: "12px 18px", borderRadius: 10, background: "#7251ae", color: "white", fontWeight: 700 }}>
        {pending ? "Saving…" : "Approve & save as new CV version"}
      </button>
      {save && <button type="button" disabled={pending} onClick={undo}>Undo saved version</button>}
      {save && <span style={{ fontSize: 13 }}>Saved version ID: {save.id}</span>}
    </div>
    <p role="status">{notice}</p>
    <p style={{ fontSize: 13, opacity: .75 }}>Only a user-authored replacement is saved. Review factual accuracy yourself. Saved versions are available through Orire’s existing Library.</p>
  </section>;
}
