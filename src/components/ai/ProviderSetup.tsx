"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useRefineStore } from "@/lib/store/refineStore";
import { PROVIDERS, isCLI, type ProviderId } from "@/lib/ai/types";
import type { ModelsResponse } from "@/app/api/ai/models/route";
import type { CliStatus } from "@/app/api/ai/cli/route";

const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];
const API_IDS = PROVIDER_IDS.filter((p) => !isCLI(p));
const CLI_IDS = PROVIDER_IDS.filter((p) => isCLI(p));

type FetchState = { phase: "idle" | "loading" | "done" | "error"; models: string[]; error?: string };

function emptyRecord<T>(make: () => T): Record<ProviderId, T> {
  return Object.fromEntries(PROVIDER_IDS.map((p) => [p, make()])) as Record<ProviderId, T>;
}

/**
 * Shared provider connection UI. Used both as the standalone "Connect" workspace
 * and as the first step of the Refine module.
 *
 * Two connection kinds:
 *   - API providers (OpenAI, Anthropic): BYO key + model discovery.
 *   - CLI providers (Claude Code): no key — uses the local login; we probe the
 *     binary for availability and offer model aliases.
 *
 * When `selectable` is true, each card carries a run toggle bound to the Refine
 * store — pick one assistant for a single pass, or two to compare in parallel.
 */
export function ProviderSetup({ selectable = false }: { selectable?: boolean }) {
  const keys = useSettingsStore((s) => s.keys);
  const models = useSettingsStore((s) => s.models);
  const setKey = useSettingsStore((s) => s.setKey);
  const setModel = useSettingsStore((s) => s.setModel);

  const runProviders = useRefineStore((s) => s.runProviders);
  const toggleRunProvider = useRefineStore((s) => s.toggleRunProvider);

  const [reveal, setReveal] = useState<Record<ProviderId, boolean>>(() => emptyRecord(() => false));
  const [fetched, setFetched] = useState<Record<ProviderId, FetchState>>(() =>
    emptyRecord<FetchState>(() => ({ phase: "idle", models: [] }))
  );
  const [cli, setCli] = useState<{ phase: "idle" | "loading" | "done"; status?: CliStatus }>({ phase: "idle" });
  const timers = useRef<Record<ProviderId, ReturnType<typeof setTimeout> | null>>(emptyRecord(() => null));

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

  // Auto-fetch models once an API key is present (debounced).
  useEffect(() => {
    const t = timers.current;
    for (const p of API_IDS) {
      const key = keys[p]?.trim();
      if (t[p]) clearTimeout(t[p]!);
      if (!key) {
        setFetched((f) => (f[p].phase === "idle" ? f : { ...f, [p]: { phase: "idle", models: [] } }));
        continue;
      }
      t[p] = setTimeout(() => void loadModels(p), 600);
    }
    return () => {
      for (const p of API_IDS) if (t[p]) clearTimeout(t[p]!);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.openai, keys.anthropic]);

  // Probe CLI availability once, if any CLI provider exists.
  const probeCli = async () => {
    setCli({ phase: "loading" });
    try {
      const res = await fetch("/api/ai/cli");
      setCli({ phase: "done", status: (await res.json()) as CliStatus });
    } catch (e) {
      setCli({ phase: "done", status: { installed: false, error: e instanceof Error ? e.message : String(e) } });
    }
  };
  useEffect(() => {
    if (CLI_IDS.length > 0) void probeCli();
  }, []);

  return (
    <div className="conn-grid">
      {PROVIDER_IDS.map((p, i) => {
        const meta = PROVIDERS[p];
        const cliProvider = isCLI(p);
        const cliReady = cliProvider && cli.phase === "done" && !!cli.status?.installed;
        const connected = cliProvider ? cliReady : Boolean(keys[p]?.trim());
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
                {cliProvider && <span className="conn-tag">CLI</span>}
              </div>
              {selectable ? (
                <button
                  className={`conn-select${selected ? " on" : ""}`}
                  onClick={() => toggleRunProvider(p)}
                  aria-pressed={selected}
                >
                  {selected ? "Selected" : "Select"}
                </button>
              ) : connected ? (
                <span className="conn-ok">Connected</span>
              ) : (
                <span className="conn-warn">{cliProvider ? "Not found" : "No key"}</span>
              )}
            </div>

            {cliProvider ? (
              <div className="conn-field">
                <span className="ed-label">Connection</span>
                <div className="conn-cli-status">
                  {cli.phase !== "done" ? (
                    <span className="conn-hint">Checking for the Claude Code CLI…</span>
                  ) : cli.status?.installed ? (
                    <span className="conn-cli-ok">✓ {cli.status.version ?? "Claude Code"} detected</span>
                  ) : (
                    <span className="conn-cli-err">
                      Not found — install Claude Code and sign in, then re-check.
                      {cli.status?.error ? <em> ({cli.status.error})</em> : null}
                    </span>
                  )}
                  <button className="conn-refresh" onClick={() => void probeCli()} disabled={cli.phase === "loading"} title="Re-check">
                    {cli.phase === "loading" ? "…" : "↻"}
                  </button>
                </div>
                <span className="conn-hint">{meta.authHint}</span>
              </div>
            ) : (
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
            )}

            <label className="conn-field">
              <span className="ed-label">
                Model
                <span className="conn-hint">
                  {(() => {
                    if (cliProvider) return " — alias (sonnet / opus / haiku) or a full model name";
                    const st = fetched[p];
                    if (!connected) return " — add a key to load your models";
                    if (st.phase === "loading") return " — loading your models…";
                    if (st.phase === "done") return ` — ${st.models.length} from your account`;
                    return " — pick one or type any model ID";
                  })()}
                </span>
                {!cliProvider && connected && (
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
              {!cliProvider && fetched[p].phase === "error" && fetched[p].error && (
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
