"use client";
import { useState } from "react";
import { previewCvEdit } from "@/lib/occ/editPreview";

type Recommendation = { requirement: string; cvEvidence: string | null; suggestion: string; assessment: string };

export function OccDraftReview({ original, recommendations }: { original: string; recommendations: Recommendation[] }) {
  const [draft, setDraft] = useState(original);
  const [selected, setSelected] = useState(-1);
  const [replacement, setReplacement] = useState("");
  const [message, setMessage] = useState("");
  const evidence = recommendations.filter((r) => r.cvEvidence && r.assessment === "supported");
  const chosen = evidence[selected];
  const preview = chosen?.cvEvidence ? previewCvEdit(draft, { before: chosen.cvEvidence, after: replacement }) : null;

  function approve() {
    if (preview === null) return;
    setDraft(preview);
    setSelected(-1);
    setReplacement("");
    setMessage("Approved wording added to your local draft. The original and saved CV are unchanged.");
  }

  return <section style={{ display: "grid", gap: 14, border: "1px solid #c8c1d9", padding: 20, borderRadius: 14 }}>
    <h3 style={{ fontSize: 20, fontWeight: 700 }}>Review CV wording changes</h3>
    <p style={{ fontSize: 13, opacity: .8 }}>Choose a supported passage, write the new wording yourself, and preview before approving. This only updates an in-browser draft—not your saved Orire CV. Confirm that all claims are true.</p>
    {evidence.length === 0 ? <p>No quoted, supported CV passages are available for safe replacement.</p> : <>
      <label style={{ display: "grid", gap: 6 }}>CV passage to review
        <select value={selected} onChange={e => { const next = Number(e.target.value); setSelected(next); setReplacement(next >= 0 ? evidence[next]?.cvEvidence ?? "" : ""); setMessage(""); }}
          style={{ padding: 10, borderRadius: 8, color: "inherit", background: "transparent" }}>
          <option value={-1}>Select a verified passage</option>
          {evidence.map((r, i) => <option key={i} value={i}>{r.requirement}</option>)}
        </select>
      </label>
      {chosen && <div style={{ display: "grid", gap: 8 }}>
        <p><strong>Original evidence:</strong> {chosen.cvEvidence}</p>
        <p><strong>OCC suggestion:</strong> {chosen.suggestion}</p>
        <label style={{ display: "grid", gap: 6 }}>Your proposed replacement
          <textarea value={replacement} onChange={e => setReplacement(e.target.value)}
            maxLength={1000} style={{ width: "100%", minHeight: 85, border: "1px solid #c8c1d9", padding: 12, borderRadius: 10, color: "inherit", background: "transparent" }} />
        </label>
        <p style={{ fontSize: 13 }}>Preview: {preview !== null ? "Ready — see updated draft below." : "Replacement cannot be applied: the passage must occur exactly once in the current draft and replacement cannot be blank."}</p>
        <button disabled={preview === null} type="button" onClick={approve} style={{ justifySelf: "start", padding: "10px 16px", background: "#7251ae", border: 0, borderRadius: 10, color: "#fff" }}>Approve wording in local draft</button>
      </div>}
    </>}
    <label style={{ display: "grid", gap: 6 }}>Working draft (not saved to Orire)
      <textarea readOnly value={draft} style={{ width: "100%", minHeight: 160, border: "1px solid #c8c1d9", borderRadius: 10, padding: 12, color: "inherit", background: "transparent" }} />
    </label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      <button type="button" onClick={() => { setDraft(original); setSelected(-1); setReplacement(""); setMessage("Working draft reset to the original submitted CV."); }}>Reset draft</button>
      <button type="button" onClick={() => { void navigator.clipboard.writeText(draft).then(() => setMessage("Draft copied.")).catch(() => setMessage("Could not copy draft.")); }}>Copy working draft</button>
    </div>
    <p role="status" style={{ fontSize: 13 }}>{message}</p>
  </section>;
}
