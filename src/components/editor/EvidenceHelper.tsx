"use client";

import { useState } from "react";
import { EVIDENCE_QUESTIONS, type EvidenceInput } from "@/lib/ai/evidence";

type Answers = Pick<EvidenceInput, "action" | "scale" | "result" | "timeframe">;
const EMPTY: Answers = { action: "", scale: "", result: "", timeframe: "" };

/** Guided "turn this into numbers" form. Never invents figures: only phrases what the user typed. */
export function EvidenceHelper({
  role,
  company,
  seed,
  onAdd,
  onClose,
}: {
  role: string;
  company: string;
  seed?: string;
  onAdd: (bullet: string) => void;
  onClose: () => void;
}) {
  const [a, setA] = useState<Answers>({ ...EMPTY, action: seed ?? "" });
  const [bullet, setBullet] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function draft() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/evidence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, company, ...a }),
      });
      const data = (await res.json()) as { ok: boolean; bullet?: string; error?: string };
      if (data.ok && data.bullet) setBullet(data.bullet);
      else setError(data.error || "Couldn't draft a bullet.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ed-evidence">
      <p className="ed-evidence-intro">
        Answer what you can. Rough numbers are fine, and we only use what you type. Nothing is invented.
      </p>
      {EVIDENCE_QUESTIONS.map((q) => (
        <label key={q.key} className="ed-field">
          <span className="ed-label">{q.label}</span>
          <input
            className="ed-input"
            value={a[q.key]}
            placeholder={q.placeholder}
            onChange={(e) => setA({ ...a, [q.key]: e.target.value })}
          />
        </label>
      ))}
      {error && <p className="ed-evidence-error" role="alert">{error}</p>}
      {bullet && (
        <textarea
          className="ed-input ed-area"
          rows={3}
          value={bullet}
          onChange={(e) => setBullet(e.target.value)}
          aria-label="Drafted bullet"
        />
      )}
      <div className="ed-evidence-actions">
        <button className="ed-add ed-add-sm" disabled={busy || !a.action.trim()} onClick={draft}>
          {busy ? "Drafting…" : bullet ? "Redraft" : "Draft bullet"}
        </button>
        {bullet && (
          <button className="ed-add ed-add-sm" onClick={() => { onAdd(bullet); onClose(); }}>
            Add to CV
          </button>
        )}
        <button className="ed-mini" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
