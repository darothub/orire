"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useRefineStore } from "@/lib/store/refineStore";
import { usePlanStore } from "@/lib/store/planStore";
import { usePooledStore } from "@/lib/store/pooledStore";
import { PROVIDERS, isCLI, type ProviderId } from "@/lib/ai/types";
import { PLANS, providerCountAllowed } from "@/lib/plan/plan";
import type { ModelsResponse } from "@/app/api/ai/models/route";
import type { CliStatus } from "@/app/api/ai/cli/route";

const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];
const API_IDS = PROVIDER_IDS.filter((p) => !isCLI(p));
const CLI_IDS = PROVIDER_IDS.filter((p) => isCLI(p));

type FetchState = { phase: "idle" | "loading" | "done" | "error"; models: string[]; error?: string };

type CliState = { phase: "idle" | "loading" | "done"; status?: CliStatus };

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
  const defaultProvider = useSettingsStore((s) => s.provider);
  const setProvider = useSettingsStore((s) => s.setProvider);

  const runProviders = useRefineStore((s) => s.runProviders);
  const toggleRunProvider = useRefineStore((s) => s.toggleRunProvider);
  const plan = usePlanStore((s) => s.plan);
  const planMeta = PLANS[plan];
  const pooledProviders = usePooledStore((s) => s.providers);
  const refreshPooled = usePooledStore((s) => s.refresh);

  useEffect(() => {
    void refreshPooled();
  }, [refreshPooled]);

  const [reveal, setReveal] = useState<Record<ProviderId, boolean>>(() => emptyRecord(() => false));
  const [fetched, setFetched] = useState<Record<ProviderId, FetchState>>(() =>
    emptyRecord<FetchState>(() => ({ phase: "idle", models: [] }))
  );
  const [cli, setCli] = useState<Record<ProviderId, CliState>>(() => emptyRecord<CliState>(() => ({ phase: "idle" })));
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

  // Probe CLI availability per provider.
  const probeCli = async (p: ProviderId) => {
    setCli((c) => ({ ...c, [p]: { phase: "loading" } }));
    try {
      const res = await fetch(`/api/ai/cli?provider=${encodeURIComponent(p)}`);
      const status = (await res.json()) as CliStatus;
      setCli((c) => ({ ...c, [p]: { phase: "done", status } }));
    } catch (e) {
      setCli((c) => ({ ...c, [p]: { phase: "done", status: { installed: false, error: e instanceof Error ? e.message : String(e) } } }));
    }
  };
  useEffect(() => {
    for (const p of CLI_IDS) void probeCli(p);
  }, []);
  const isConnected = (p: ProviderId): boolean =>
    isCLI(p) ? cli[p].phase === "done" && !!cli[p].status?.installed : Boolean(keys[p]?.trim());

  return (
    <div className="conn-wrap">
      {selectable && (
        <div className="conn-planhint">
          <span className="conn-dot openai" aria-hidden />
          <span>
            <strong>{planMeta.label}</strong> —{" "}
            {planMeta.allowCompare
              ? `compare up to ${planMeta.maxProviders} assistants in parallel.`
              : "single assistant only. Upgrade to Pro to compare two side by side."}
          </span>
        </div>
      )}
      {!selectable && (
        <div className="conn-default">
          <div className="conn-default-head">
            <span className="ed-label">Default assistant</span>
            <span className="conn-hint">
              Used for importing, structuring, simulation and single-pass refine. Comparison uses the
              assistants you pick in Refine.
            </span>
          </div>
          <div className="conn-switch" role="tablist" aria-label="Default assistant">
            {PROVIDER_IDS.map((p) => {
              const ready = isConnected(p);
              const active = p === defaultProvider;
              return (
                <button
                  key={p}
                  role="tab"
                  aria-selected={active}
                  className={`conn-switch-opt${active ? " on" : ""}`}
                  onClick={() => setProvider(p)}
                  title={ready ? undefined : "Not connected yet — connect below to use it"}
                >
                  <span className={`conn-dot ${p}`} />
                  {PROVIDERS[p].label}
                  {!ready && <span className="conn-switch-warn" aria-hidden>•</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="conn-grid">
      {PROVIDER_IDS.map((p, i) => {
        const meta = PROVIDERS[p];
        const cliProvider = isCLI(p);
        const cliState = cli[p];
        const cliReady = cliProvider && cliState.phase === "done" && !!cliState.status?.installed;
        const connected = cliProvider ? cliReady : Boolean(keys[p]?.trim());
        const teamCovered = !cliProvider && !keys[p]?.trim() && pooledProviders.includes(p);
        const selected = runProviders.includes(p);
        const isDefault = !selectable && p === defaultProvider;
        return (
          <motion.div
            key={p}
            className={`conn-card${selectable && selected ? " selected" : ""}${isDefault ? " is-default" : ""}`}
            initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.06 * i, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="conn-card-head">
              <div className="conn-brand">
                <span className={`conn-dot ${p}`} />
                <strong>{meta.label}</strong>
                {cliProvider && <span className="conn-tag">CLI</span>}
                {isDefault && <span className="conn-tag default">Default</span>}
              </div>
              {selectable ? (
                (() => {
                  const gate = providerCountAllowed(plan, runProviders.length + 1);
                  const atLimit = !selected && !gate.allowed;
                  return (
                    <button
                      className={`conn-select${selected ? " on" : ""}`}
                      onClick={() => !atLimit && toggleRunProvider(p)}
                      aria-pressed={selected}
                      disabled={atLimit}
                      title={atLimit ? gate.reason : undefined}
                    >
                      {selected ? "Selected" : atLimit ? "Locked" : "Select"}
                    </button>
                  );
                })()
              ) : connected ? (
                isDefault ? <span className="conn-ok">Connected</span> : (
                  <button className="conn-setdefault" onClick={() => setProvider(p)} title="Use as default assistant">
                    Set default
                  </button>
                )
              ) : teamCovered ? (
                <span className="conn-ok conn-team" title="Your team pools a key for this provider — premium runs use it, no personal key needed.">
                  Covered by your team
                </span>
              ) : (
                <span className="conn-warn">{cliProvider ? "Not found" : "No key"}</span>
              )}
            </div>

            {cliProvider ? (
              <div className="conn-field">
                <span className="ed-label">Connection</span>
                <div className="conn-cli-status">
                  {cliState.phase !== "done" ? (
                    <span className="conn-hint">Checking for the {meta.label} binary…</span>
                  ) : cliState.status?.installed ? (
                    <span className="conn-cli-ok">✓ {cliState.status.version ?? meta.label} detected</span>
                  ) : (
                    <span className="conn-cli-err">
                      Not found — install {meta.label} and sign in, then re-check.
                      {cliState.status?.error ? <em> ({cliState.status.error})</em> : null}
                    </span>
                  )}
                  <button className="conn-refresh" onClick={() => void probeCli(p)} disabled={cliState.phase === "loading"} title="Re-check">
                    {cliState.phase === "loading" ? "…" : "↻"}
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
                    if (cliProvider) {
                      return meta.models.length > 0
                        ? ` — ${meta.models.slice(0, 3).join(" / ")} or any model name`
                        : " — leave blank to use the model your login exposes";
                    }
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
                placeholder={cliProvider && !meta.defaultModel ? "Assistant default" : meta.defaultModel}
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
    </div>
  );
}
