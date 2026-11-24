"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { CVData } from "@/lib/cv/schema";
import { cvFieldChoices, readCvField } from "@/lib/occ/versionPatch";
import { CopilotCard } from "@/components/ui/CopilotCard";
import { Button } from "@/components/ui/Button";

type Source = { id: string; title: string; company: string | null; template: string; updatedAt: string; data: CVData };

const Spark = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="var(--or-violet)" strokeWidth="2" aria-hidden>
    <path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.5 5.7 21l2.3-7.1-6-4.5h7.6z" />
  </svg>
);

/**
 * CV Improvement — the occ4 workbench for approving a single wording change into
 * a new, private CV version. It reuses the same gated route occ2 uses
 * (GET/POST /api/occ/versions) and the shared field taxonomy (cvFieldChoices).
 *
 * It never overwrites a source CV and never activates the new version: a saved
 * revision is an additional private document in the user's Library. Only the
 * user's own typed replacement is saved — OCC proposes, the user approves.
 */
export function Occ4Improve() {
  const [documents, setDocuments] = useState<Source[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [fieldIndex, setFieldIndex] = useState(-1);
  const [replacement, setReplacement] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [save, setSave] = useState<{ id: string; undoId: string } | null>(null);

  const source = documents.find((doc) => doc.id === sourceId);
  const available = source ? cvFieldChoices(source.data) : [];
  const selected = available[fieldIndex];
  const original = selected && source ? readCvField(source.data, selected.field) : null;
  const canSave = Boolean(
    original !== null &&
      replacement.trim().length >= 10 &&
      replacement.length <= 1500 &&
      replacement.trim() !== original &&
      !pending &&
      !save,
  );

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/occ/versions", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load your saved CVs.");
        const data = await response.json();
        if (!cancelled) setDocuments(Array.isArray(data.documents) ? data.documents : []);
      })
      .catch((error) => {
        if (!cancelled) setNotice(error instanceof Error ? error.message : "Could not load your saved CVs.");
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveVersion() {
    if (!canSave || !source || !selected || original === null) return;
    setPending(true);
    setNotice("");
    try {
      const response = await fetch("/api/occ/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: source.id,
          expectedUpdatedAt: source.updatedAt,
          field: selected.field,
          expectedText: original,
          replacement,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save the version.");
      setSave({ id: data.id, undoId: data.undoId });
      setNotice("Saved as a new private version in your CV Library. Your original and active CV are unchanged.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save the version.");
    } finally {
      setPending(false);
    }
  }

  async function undo() {
    if (!save || !window.confirm("Delete this OCC-created version? Your original CV stays intact.")) return;
    setPending(true);
    setNotice("");
    try {
      const response = await fetch(`/api/occ/versions/${encodeURIComponent(save.undoId)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not undo.");
      setSave(null);
      setSourceId("");
      setFieldIndex(-1);
      setReplacement("");
      setNotice("Version deleted. Your original CV is unchanged.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not undo.");
    } finally {
      setPending(false);
    }
  }

  let body: ReactNode;
  if (!loaded) {
    body = <p className="occ4-improve-empty">Loading your saved CVs…</p>;
  } else if (documents.length === 0) {
    body = (
      <p className="occ4-improve-empty">
        No saved CVs yet. Build one in the editor first, then come back here to approve wording changes
        into a new version.
      </p>
    );
  } else {
    body = (
      <div className="occ4-improve">
        <label className="occ4-improve-label">
          Which saved CV?
          <select
            className="occ4-improve-select"
            value={sourceId}
            disabled={!!save}
            onChange={(e) => {
              setSourceId(e.target.value);
              setFieldIndex(-1);
              setReplacement("");
              setSave(null);
              setNotice("");
            }}
          >
            <option value="">Choose a saved CV</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.title}
                {doc.company ? ` · ${doc.company}` : ""}
              </option>
            ))}
          </select>
        </label>

        {source && (
          <label className="occ4-improve-label">
            Which part?
            <select
              className="occ4-improve-select"
              value={fieldIndex}
              disabled={!!save}
              onChange={(e) => {
                const index = Number(e.target.value);
                setFieldIndex(index);
                setReplacement(index >= 0 ? available[index]?.text ?? "" : "");
                setSave(null);
                setNotice("");
              }}
            >
              <option value={-1}>Choose the summary or a bullet</option>
              {available.map((item, index) => (
                <option value={index} key={index}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {original !== null && (
          <div className="occ4-improve-edit">
            <label className="occ4-improve-label">
              Current wording
              <textarea className="occ4-improve-text" readOnly value={original} rows={4} />
            </label>
            <label className="occ4-improve-label">
              Your approved wording
              <textarea
                className="occ4-improve-text"
                value={replacement}
                maxLength={1500}
                disabled={!!save}
                onChange={(e) => {
                  setReplacement(e.target.value);
                  setSave(null);
                }}
                rows={4}
              />
            </label>
          </div>
        )}

        {source && (
          <p className="occ4-improve-meta">
            Source last updated {new Date(source.updatedAt).toLocaleString()}. The new version inherits this
            CV&rsquo;s template and is not made active automatically.
          </p>
        )}

        <div className="occ4-improve-actions">
          <Button variant="gold" size="sm" disabled={!canSave} onClick={() => void saveVersion()}>
            {pending ? "Saving…" : "Approve & save as new version"}
          </Button>
          {save && (
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => void undo()}>
              Undo
            </Button>
          )}
          {save && <span className="occ4-improve-id">Version ID {save.id}</span>}
        </div>

        {notice && (
          <p className="occ4-improve-notice" role="status">
            {notice}
          </p>
        )}
      </div>
    );
  }

  return (
    <CopilotCard title="CV Improvement" icon={<Spark />}>
      {body}
      <p className="occ4-disclaimer">
        Only wording you approve is saved. OCC never fabricates facts — check accuracy yourself. Your
        original CV is never overwritten.
      </p>
    </CopilotCard>
  );
}
