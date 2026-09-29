"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const provider = useSettingsStore((s) => s.provider);
  const keys = useSettingsStore((s) => s.keys);
  const models = useSettingsStore((s) => s.models);
  const setProvider = useSettingsStore((s) => s.setProvider);
  const setKey = useSettingsStore((s) => s.setKey);
  const setModel = useSettingsStore((s) => s.setModel);

  const [reveal, setReveal] = useState<Record<ProviderId, boolean>>({
    openai: false,
    anthropic: false,
  });

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
            <h2>AI settings</h2>
            <p>Bring your own key. Keys are stored only in this browser and sent solely to the provider you choose.</p>
          </div>
          <button className="imp-x" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="ai-field">
          <span className="ed-label">Active provider</span>
          <div className="ai-seg">
            {(Object.keys(PROVIDERS) as ProviderId[]).map((p) => (
              <button
                key={p}
                className={`ai-seg-btn ${provider === p ? "on" : ""}`}
                onClick={() => setProvider(p)}
              >
                {PROVIDERS[p].label}
              </button>
            ))}
          </div>
        </div>

        {(Object.keys(PROVIDERS) as ProviderId[]).map((p) => {
          const meta = PROVIDERS[p];
          return (
            <div key={p} className={`ai-provider ${provider === p ? "active" : ""}`}>
              <div className="ai-provider-head">
                <strong>{meta.label}</strong>
                {keys[p]?.trim() ? <span className="ai-ok">key set</span> : <span className="ai-warn">no key</span>}
              </div>
              <div className="ai-field">
                <span className="ed-label">API key</span>
                <div className="ai-key-row">
                  <input
                    className="ed-input"
                    type={reveal[p] ? "text" : "password"}
                    value={keys[p] ?? ""}
                    placeholder={meta.keyHint}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => setKey(p, e.target.value)}
                  />
                  <button
                    className="ai-reveal"
                    onClick={() => setReveal((r) => ({ ...r, [p]: !r[p] }))}
                    aria-label={reveal[p] ? "Hide key" : "Show key"}
                  >
                    {reveal[p] ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <div className="ai-field">
                <span className="ed-label">Model</span>
                <select
                  className="ed-input"
                  value={models[p]}
                  onChange={(e) => setModel(p, e.target.value)}
                >
                  {meta.models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}

        <p className="ai-note">
          orire never invents facts. AI output is checked against your CV — anything not found in your
          source is flagged or removed before it can be applied.
        </p>
      </motion.div>
    </motion.div>
  );
}
