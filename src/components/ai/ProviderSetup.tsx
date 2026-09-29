"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useRefineStore } from "@/lib/store/refineStore";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";
import type { ModelsResponse } from "@/app/api/ai/models/route";

const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

type FetchState = { phase: "idle" | "loading" | "done" | "error"; models: string[]; error?: string };

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
  const [fetched, setFetched] = useState<Record<ProviderId, FetchState>>({
    openai: { phase: "idle", models: [] },
    anthropic: { phase: "idle", models: [] },
  });
  // Debounce auto-fetch so we don't hit the provider on every keystroke.
  const timers = useRef<Record<ProviderId, ReturnType<typeof setTimeout> | null>>({ openai: null, anthropic: null });

  const loadModels = async (p: ProviderId) => {
    const key = useSettingsStore.getState().keys[p]?.trim();
    if (!key) return;
    setFetched((f) => ({ ...f, [p]: { ...f[p], phase: "loading", error: undefined } }));
    try {
      const res = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: p, apiKey: key }),
      });
      const data = (await res.json()) as ModelsResponse;
      if (!data.ok || !data.models) {
        setFetched((f) => ({ ...f, [p]: { phase: "error", models: [], error: data.error?.message ?? "Could not fetch models." } }));
        return;
      }
      setFetched((f) => ({ ...f, [p]: { phase: "done", models: data.models! } }));
      // If the selected model isn't offered by this key, adopt a sensible default
      // from the provider's real list (prevents not_found_error on a stale model).
      const current = useSettingsStore.getState().models[p];
      const list = data.models;
      if (list.length > 0 && !list.includes(current)) {
        const prefer = p === "openai" ? /gpt-4o(?!-mini)/i : /sonnet/i;
        const pick = list.find((m) => prefer.test(m)) ?? list[0]!;
        setModel(p, pick);
      }
    } catch (e) {
      setFetched((f) => ({ ...f, [p]: { phase: "error", models: [], error: e instanceof Error ? e.message : String(e) } }));
    }
  };

  // Auto-fetch once a key is present (and whenever it changes), debounced.
  useEffect(() => {
    const t = timers.current;
    for (const p of PROVIDER_IDS) {
      const key = keys[p]?.trim();
      if (t[p]) clearTimeout(t[p]!);
      if (!key) {
        setFetched((f) => (f[p].phase === "idle" ? f : { ...f, [p]: { phase: "idle", models: [] } }));
        continue;
      }
      t[p] = setTimeout(() => void loadModels(p), 600);
    }
    return () => {
      for (const p of PROVIDER_IDS) if (t[p]) clearTimeout(t[p]!);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.openai, keys.anthropic]);

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
              <span className="ed-label">
                Model
                <span className="conn-hint">
                  {(() => {
                    const st = fetched[p];
                    if (!hasKey) return " — add a key to load your models";
                    if (st.phase === "loading") return " — loading your models…";
                    if (st.phase === "done") return ` — ${st.models.length} from your account`;
                    if (st.phase === "error") return " — pick one or type any model ID";
                    return " — pick one or type any model ID";
                  })()}
                </span>
                {hasKey && (
                  <button
                    type="button"
                    className="conn-refresh"
                    onClick={() => void loadModels(p)}
                    disabled={fetched[p].phase === "loading"}
                    title="Refresh model list from the provider"
                  >
                    {fetched[p].phase === "loading" ? "…" : "↻"}
                  </button>
                )}
              </span>
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
                {(fetched[p].models.length > 0 ? fetched[p].models : meta.models).map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              {fetched[p].phase === "error" && fetched[p].error && (
                <span className="conn-model-err" title={fetched[p].error}>
                  Couldn’t load models: {fetched[p].error!.slice(0, 120)}
                </span>
              )}
            </label>
          </motion.div>
        );
      })}
    </div>
  );
}
