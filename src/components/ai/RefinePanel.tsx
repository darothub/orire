"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { PROVIDERS } from "@/lib/ai/types";
import type { RefineResponse } from "@/lib/ai/types";
import { parseModelJSON, factGround, RefineParseError, type GroundingResult } from "@/lib/ai/guardrails";
import type { CVData } from "@/lib/cv/schema";

type Phase = "input" | "running" | "error" | "preview";

function countFacts(cv: CVData) {
  return {
    experience: cv.experience.length,
    education: cv.education.length,
    projects: cv.projects.length,
    certifications: cv.certifications.length,
    skills: cv.skills.reduce((a, g) => a + g.items.length, 0),
  };
}

export function RefinePanel({ onClose, onOpenSettings }: { onClose: () => void; onOpenSettings: () => void }) {
  const cv = useCVStore((s) => s.cv);
  const applyRefinedCV = useCVStore((s) => s.applyRefinedCV);
  const provider = useSettingsStore((s) => s.provider);
  const keys = useSettingsStore((s) => s.keys);
  const models = useSettingsStore((s) => s.models);

  const meta = PROVIDERS[provider];
  const hasKey = Boolean(keys[provider]?.trim());

  const [jd, setJd] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [err, setErr] = useState<{ title: string; body: string; status?: number } | null>(null);
  const [result, setResult] = useState<GroundingResult | null>(null);

  async function run() {
    if (!hasKey) {
      setErr({ title: "No API key", body: `Add your ${meta.label} key in Settings first.` });
      setPhase("error");
      return;
    }
    if (!jd.trim()) return;
    setPhase("running");
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai/refine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: keys[provider],
          model: models[provider],
          jobDescription: jd,
          cv,
        }),
      });
      const data = (await res.json()) as RefineResponse;
      if (!data.ok || !data.raw) {
        setErr({
          title: `${meta.label} error`,
          body: data.error?.message ?? "Unknown error.",
          status: data.error?.status,
        });
        setPhase("error");
        return;
      }
      // Deterministic guardrails run on the raw model output.
      const candidate = parseModelJSON(data.raw);
      const grounded = factGround(cv, candidate);
      setResult(grounded);
      setPhase("preview");
    } catch (e) {
      const msg = e instanceof RefineParseError ? e.message : e instanceof Error ? e.message : String(e);
      setErr({ title: "Could not process the AI response", body: msg });
      setPhase("error");
    }
  }

  function apply() {
    if (!result) return;
    applyRefinedCV(result.cv);
    onClose();
  }

  const before = countFacts(cv);
  const after = result ? countFacts(result.cv) : null;

  return (
    <motion.div
      className="imp-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="imp-modal ai-modal"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="imp-head">
          <div>
            <h2>Refine to job description</h2>
            <p>
              Tailor your CV to a role using {meta.label}. Only facts already in your CV are used —
              nothing is invented.
            </p>
          </div>
          <button className="imp-x" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="ai-runbar">
          <span className={`ai-pill ${hasKey ? "" : "muted"}`}>
            {meta.label} · {models[provider]}
          </span>
          <button className="ai-link" onClick={onOpenSettings}>Settings</button>
        </div>

        {(phase === "input" || phase === "running" || phase === "error") && (
          <>
            <div className="ai-field">
              <span className="ed-label">Job description</span>
              <textarea
                className="ed-input ai-jd"
                value={jd}
                placeholder="Paste the full job description here…"
                onChange={(e) => setJd(e.target.value)}
                rows={10}
                disabled={phase === "running"}
              />
            </div>

            {phase === "error" && err && (
              <div className="imp-error">
                <strong>{err.title}{err.status ? ` (HTTP ${err.status})` : ""}</strong>
                <pre>{err.body}</pre>
              </div>
            )}

            <div className="imp-actions">
              <button
                className="imp-btn primary"
                onClick={run}
                disabled={phase === "running" || !jd.trim()}
              >
                {phase === "running" ? "Refining…" : "Refine CV"}
              </button>
              {!hasKey && (
                <button className="imp-btn" onClick={onOpenSettings}>Add API key</button>
              )}
            </div>
          </>
        )}

        {phase === "preview" && result && after && (
          <div className="ai-preview">
            <div className="ai-delta">
              <DeltaRow label="Experience" a={before.experience} b={after.experience} />
              <DeltaRow label="Education" a={before.education} b={after.education} />
              <DeltaRow label="Projects" a={before.projects} b={after.projects} />
              <DeltaRow label="Certifications" a={before.certifications} b={after.certifications} />
              <DeltaRow label="Skills" a={before.skills} b={after.skills} />
            </div>

            {result.cv.basics.summary && (
              <div className="ai-summary">
                <span className="ed-label">Tailored summary</span>
                <p>{result.cv.basics.summary}</p>
              </div>
            )}

            <AnimatePresence>
              {result.warnings.length > 0 ? (
                <motion.div className="ai-flags" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <strong>{result.warnings.length} guardrail note{result.warnings.length > 1 ? "s" : ""}</strong>
                  <ul>
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </motion.div>
              ) : (
                <motion.div className="ai-clean" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  ✓ Every item is grounded in your source CV.
                </motion.div>
              )}
            </AnimatePresence>

            <div className="imp-actions">
              <button className="imp-btn primary" onClick={apply}>Apply to editor</button>
              <button className="imp-btn" onClick={() => setPhase("input")}>Back</button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function DeltaRow({ label, a, b }: { label: string; a: number; b: number }) {
  const diff = b - a;
  return (
    <div className="ai-delta-row">
      <span className="ai-delta-label">{label}</span>
      <span className="ai-delta-nums">
        {a} <span className="ai-arrow">→</span> {b}
        {diff !== 0 && (
          <span className={`ai-diff ${diff > 0 ? "up" : "down"}`}>
            {diff > 0 ? `+${diff}` : diff}
          </span>
        )}
      </span>
    </div>
  );
}
