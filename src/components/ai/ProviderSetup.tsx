"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useRefineStore } from "@/lib/store/refineStore";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";

const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

/**
 * Shared provider connection UI (BYO key). Used both as the standalone
 * "Connect" workspace and as the first step of the Refine module.
 *
 * When `selectable` is true, each provider card also carries a run toggle bound
 * to the Refine store — pick one assistant for a single tailored pass, or two to
 * compare them in parallel.
 */
export function ProviderSetup({ selectable = false }: { selectable?: boolean }) {
  const keys = useSettingsStore((s) => s.keys);
  const models = useSettingsStore((s) => s.models);
  const setKey = useSettingsStore((s) => s.setKey);
  const setModel = useSettingsStore((s) => s.setModel);

  const runProviders = useRefineStore((s) => s.runProviders);
  const toggleRunProvider = useRefineStore((s) => s.toggleRunProvider);

  const [reveal, setReveal] = useState<Record<ProviderId, boolean>>({ openai: false, anthropic: false });

  return (
    <div className="conn-grid">
      {PROVIDER_IDS.map((p, i) => {
        const meta = PROVIDERS[p];
        const hasKey = Boolean(keys[p]?.trim());
        const selected = runProviders.includes(p);
        return (
          <motion.div
            key={p}
            className={`conn-card${selectable && selected ? " selected" : ""}`}
            initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.06 * i, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="conn-card-head">
              <div className="conn-brand">
                <span className={`conn-dot ${p}`} />
                <strong>{meta.label}</strong>
              </div>
              {selectable ? (
                <button
                  className={`conn-select${selected ? " on" : ""}`}
                  onClick={() => toggleRunProvider(p)}
                  aria-pressed={selected}
                >
                  {selected ? "Selected" : "Select"}
                </button>
              ) : hasKey ? (
                <span className="conn-ok">Connected</span>
              ) : (
                <span className="conn-warn">No key</span>
              )}
            </div>

            <label className="conn-field">
              <span className="ed-label">API key</span>
              <div className="conn-key-row">
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
                  className="conn-reveal"
                  onClick={() => setReveal((r) => ({ ...r, [p]: !r[p] }))}
                  aria-label={reveal[p] ? "Hide key" : "Show key"}
                >
                  {reveal[p] ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <label className="conn-field">
              <span className="ed-label">Model <span className="conn-hint">— pick one or type any model ID</span></span>
              <input
                className="ed-input"
                list={`models-${p}`}
                value={models[p]}
                spellCheck={false}
                autoComplete="off"
                placeholder={meta.defaultModel}
                onChange={(e) => setModel(p, e.target.value)}
              />
              <datalist id={`models-${p}`}>
                {meta.models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </label>
          </motion.div>
        );
      })}
    </div>
  );
}
