"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCVStore } from "@/lib/store/cvStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useViewStore } from "@/lib/store/viewStore";
import { PROVIDERS } from "@/lib/ai/types";
import type { RefineResponse } from "@/lib/ai/types";
import { coerceSimulatedCV, gapAnalysis, type GapAnalysis } from "@/lib/ai/simulate";
import { RefineParseError } from "@/lib/ai/guardrails";
import { getTemplate } from "@/components/templates/registry";
import { SECTION_LABELS, type CVData, type SectionKey } from "@/lib/cv/schema";

type Phase = "input" | "running" | "error" | "result";

function coverageColor(v: number): string {
  const hue = Math.round((v / 100) * 130);
  return `hsl(${hue} 70% 45%)`;
}

export function SimulateView() {
  const userCV = useCVStore((s) => s.cv);
  const activeTemplate = useCVStore((s) => s.activeTemplate);
  const provider = useSettingsStore((s) => s.provider);
  const keys = useSettingsStore((s) => s.keys);
  const models = useSettingsStore((s) => s.models);
  const setView = useViewStore((s) => s.setView);

  const meta = PROVIDERS[provider];
  const hasKey = Boolean(keys[provider]?.trim());
  const Tpl = getTemplate(activeTemplate).Component;

  const [jd, setJd] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [err, setErr] = useState<{ title: string; body: string; status?: number } | null>(null);
  const [ideal, setIdeal] = useState<CVData | null>(null);
  const [gap, setGap] = useState<GapAnalysis | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    if (!hasKey) {
      setErr({ title: "No API key", body: `Add your ${meta.label} key in Settings first.` });
      setPhase("error");
      return;
    }
    if (!jd.trim()) return;
    setPhase("running");
    setErr(null);
    setIdeal(null);
    setGap(null);
    try {
      const res = await fetch("/api/ai/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, apiKey: keys[provider], model: models[provider], jobDescription: jd }),
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
      const cv = coerceSimulatedCV(data.raw);
      setIdeal(cv);
      setGap(gapAnalysis(userCV, cv));
      setPhase("result");
    } catch (e) {
      const msg = e instanceof RefineParseError ? e.message : e instanceof Error ? e.message : String(e);
      setErr({ title: "Could not build the simulation", body: msg });
      setPhase("error");
    }
  }

  function copyJD() {
    navigator.clipboard?.writeText(jd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <motion.div
      className="ws-view sim-view"
      initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
        <div className="ws-head">
          <div>
            <h2>Simulate a 100% match</h2>
            <p>
              See what an ideal candidate&apos;s CV would look like for a role — then measure your
              gap. This profile is <strong>simulated</strong>, not your facts.
            </p>
          </div>
        </div>

        <div className="ai-runbar">
          <span className={`ai-pill ${hasKey ? "" : "muted"}`}>{meta.label} · {models[provider]}</span>
          <button className="ai-link" onClick={() => setView("connect")}>Connect AI</button>
        </div>

        <AnimatePresence mode="wait">
          {(phase === "input" || phase === "running") && (
            <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <label className="ed-label" htmlFor="sim-jd">Job description</label>
              <textarea
                id="sim-jd"
                className="ed-input sim-jd"
                placeholder="Paste the full job description…"
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                disabled={phase === "running"}
              />
              <div className="imp-actions">
                <button className="imp-btn" onClick={() => setView("edit")}>Cancel</button>
                <button className="imp-btn primary" onClick={run} disabled={phase === "running" || !jd.trim()}>
                  {phase === "running" ? (
                    <><span className="cmp-spinner" /> Building ideal candidate…</>
                  ) : (
                    "Simulate match"
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {phase === "error" && err && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="imp-error">
                <strong>{err.title}{err.status ? ` (HTTP ${err.status})` : ""}</strong>
                <pre>{err.body}</pre>
              </div>
              <div className="imp-actions">
                <button className="imp-btn" onClick={() => setPhase("input")}>Back</button>
              </div>
            </motion.div>
          )}

          {phase === "result" && ideal && gap && (
            <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="sim-result">
              <div className="sim-gap">
                <div className="sim-cov">
                  <svg viewBox="0 0 84 84" width="84" height="84" className="sim-cov-svg">
                    <circle cx="42" cy="42" r="34" className="rate-ring-track" />
                    <motion.circle
                      cx="42"
                      cy="42"
                      r="34"
                      className="rate-ring-fill"
                      stroke={coverageColor(gap.coverage)}
                      strokeDasharray={2 * Math.PI * 34}
                      initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                      animate={{ strokeDashoffset: (2 * Math.PI * 34) * (1 - gap.coverage / 100) }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="sim-cov-center"><strong style={{ color: coverageColor(gap.coverage) }}>{gap.coverage}%</strong></div>
                  <span className="rate-ring-label">Your match</span>
                </div>

                <div className="sim-gap-lists">
                  {gap.missingSkills.length > 0 && (
                    <div className="sim-gap-block">
                      <span className="sim-gap-title miss">Skills to add ({gap.missingSkills.length})</span>
                      <div className="sim-chips">
                        {gap.missingSkills.slice(0, 24).map((s) => (
                          <span key={s} className="sim-chip miss">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {gap.matchedSkills.length > 0 && (
                    <div className="sim-gap-block">
                      <span className="sim-gap-title match">Already matched ({gap.matchedSkills.length})</span>
                      <div className="sim-chips">
                        {gap.matchedSkills.slice(0, 24).map((s) => (
                          <span key={s} className="sim-chip match">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {gap.missingSections.length > 0 && (
                    <div className="sim-gap-block">
                      <span className="sim-gap-title miss">Sections the ideal has that you don&apos;t</span>
                      <div className="sim-chips">
                        {gap.missingSections.map((k) => (
                          <span key={k} className="sim-chip miss">{SECTION_LABELS[k as SectionKey]}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {gap.missingSkills.length === 0 && gap.missingSections.length === 0 && (
                    <p className="sim-perfect">You already cover every skill in the ideal profile. 🎯</p>
                  )}
                </div>
              </div>

              <p className="sim-note">
                This is a target benchmark generated from the job description — not real experience.
                To tailor <em>your own</em> facts to this role, use <strong>Refine to JD</strong>.
              </p>

              <div className="sim-preview-wrap">
                <span className="sim-ribbon">SIMULATED</span>
                <div className="sim-paper">
                  <Tpl cv={ideal} />
                </div>
              </div>

              <div className="imp-actions">
                <button className="imp-btn" onClick={copyJD}>{copied ? "Copied ✓" : "Copy job description"}</button>
                <button className="imp-btn" onClick={() => setPhase("input")}>New simulation</button>
                <button className="imp-btn primary" onClick={() => setView("edit")}>Done</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
    </motion.div>
  );
}
