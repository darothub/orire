"use client";
import { useState } from "react";
import { previewCvEdit } from "@/lib/occ/editPreview";

type Recommendation = { requirement: string; cvEvidence: string | null; suggestion: string; sampleWording?: string | null; assessment: string };

export function OccDraftReview({ original, recommendations }: { original: string; recommendations: Recommendation[] }) {
  const [draft, setDraft] = useState(original);
  const [selected, setSelected] = useState(-1);
  const [replacement, setReplacement] = useState("");
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [previousDraft, setPreviousDraft] = useState<string | null>(null);
  const evidence = recommendations.filter((r) => r.cvEvidence && r.assessment === "supported");
  const chosen = evidence[selected];
  const preview = chosen?.cvEvidence ? previewCvEdit(draft, { before: chosen.cvEvidence, after: replacement }) : null;

  function approve() {
    if (preview === null || !confirmed) return;
    setPreviousDraft(draft);
    setDraft(preview);
    setSelected(-1);
    setReplacement("");
    setConfirmed(false);
    setMessage("Approved wording added to your local draft. The original and saved CV are unchanged.");
  }

  return <section style={{ display: "grid", gap: 14, border: "1px solid #c8c1d9", padding: 20, borderRadius: 14 }}>
    <h3 style={{ fontSize: 20, fontWeight: 700 }}>Review CV wording changes</h3>
    <p style={{ fontSize: 13, opacity: .8 }}>Choose a passage quoted from your CV, review OCC’s optional sample wording or write your own, then preview and approve. Samples are not independently verified. Nothing updates your saved Orire CV automatically.</p>
    {evidence.length === 0 ? <p>No quoted, supported CV passages are available for safe replacement.</p> : <>
      <label style={{ display: "grid", gap: 6 }}>CV passage to review
        <select value={selected} onChange={e => { const next = Number(e.target.value); setSelected(next); setReplacement(next >= 0 ? evidence[next]?.sampleWording || evidence[next]?.cvEvidence || "" : ""); setConfirmed(false); setMessage(""); }}
          style={{ padding: 10, borderRadius: 8, color: "inherit", background: "transparent" }}>
          <option value={-1}>Select a CV-quoted passage</option>
          {evidence.map((r, i) => <option key={i} value={i}>{r.requirement}</option>)}
        </select>
      </label>
      {chosen && <div style={{ display: "grid", gap: 8 }}>
        <p><strong>Original evidence:</strong> {chosen.cvEvidence}</p>
        <p><strong>OCC recommendation:</strong> {chosen.suggestion}</p>
        {chosen.sampleWording ? <div aria-label="OCC suggested CV rewrite" style={{ display: "grid", gap: 5 }}>
          <strong>Illustrative sample wording (editable)</strong>
          <blockquote style={{ borderLeft: "3px solid #7251ae", paddingLeft: 12, margin: 0 }}>{chosen.sampleWording}</blockquote>
          <p style={{ fontSize: 12, opacity: .8 }}>Derived from words in the quoted CV passage; factual accuracy and meaning still require your personal verification.</p>
          <button type="button" style={{ justifySelf: "start" }} onClick={() => { setReplacement(chosen.sampleWording ?? ""); setConfirmed(false); }}>Use this sample in editor</button>
        </div> : <p style={{ fontSize: 12, opacity: .8 }}>No reliable evidence-only rewrite available. Write your own wording or clarify the missing facts with OCC.</p>}
        <label style={{ display: "grid", gap: 6 }}>Your proposed replacement
          <textarea value={replacement} onChange={e => { setReplacement(e.target.value); setConfirmed(false); }}
            maxLength={1000} style={{ width: "100%", minHeight: 85, border: "1px solid #c8c1d9", padding: 12, borderRadius: 10, color: "inherit", background: "transparent" }} />
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "start", fontSize: 13, fontWeight: 600 }}>
          <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
          I have checked that the proposed wording is accurate, preserves my meaning and describes only experience I genuinely have.
        </label>
        <button type="button" style={{ justifySelf: "start" }} onClick={() => { setSelected(-1); setReplacement(""); setConfirmed(false); setMessage("Suggested wording rejected. No changes were made."); }}>Reject this suggestion</button>
        <p style={{ fontSize: 13 }}>Preview: {preview !== null ? "Ready — see updated draft below." : "Replacement cannot be applied: the passage must occur exactly once in the current draft and replacement cannot be blank."}</p>
        <button disabled={preview === null || !confirmed} type="button" onClick={approve} style={{ justifySelf: "start", padding: "10px 16px", background: "#7251ae", border: 0, borderRadius: 10, color: "#fff" }}>Approve wording in local draft</button>
      </div>}
    </>}
    <label style={{ display: "grid", gap: 6 }}>Working draft (not saved to Orire)
      <textarea readOnly value={draft} style={{ width: "100%", minHeight: 160, border: "1px solid #c8c1d9", borderRadius: 10, padding: 12, color: "inherit", background: "transparent" }} />
    </label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      <button type="button" onClick={() => { setDraft(original); setPreviousDraft(null); setSelected(-1); setReplacement(""); setConfirmed(false); setMessage("Working draft reset to the original submitted CV."); }}>Reset draft</button>
      {previousDraft !== null && <button type="button" onClick={() => { setDraft(previousDraft); setPreviousDraft(null); setConfirmed(false); setMessage("Last local revision undone."); }}>Undo last local change</button>}
      <button type="button" onClick={() => { void navigator.clipboard.writeText(draft).then(() => setMessage("Draft copied.")).catch(() => setMessage("Could not copy draft.")); }}>Copy working draft</button>
    </div>
    <p role="status" style={{ fontSize: 13 }}>{message}</p>
  </section>;
}
