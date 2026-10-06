"use client";

import { motion } from "framer-motion";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useRefineStore } from "@/lib/store/refineStore";
import { usePlanStore } from "@/lib/store/planStore";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";
import { PLANS, providerCountAllowed, planQualityLabel } from "@/lib/plan/plan";

const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

/**
 * Shared provider selection UI. Used both as the standalone "Connect" workspace
 * and as the first step of the Refine module.
 *
 * Assistants are fully managed by orire — we hold the provider keys server-side,
 * so there is nothing for the user to paste. The user only picks which assistant
 * to use; the quality tier is set by their plan (no raw model names exposed).
 *
 * When `selectable` is true, each card carries a run toggle bound to the Refine
 * store — pick one assistant for a single pass, or two to compare in parallel.
 */
export function ProviderSetup({ selectable = false }: { selectable?: boolean }) {
  const defaultProvider = useSettingsStore((s) => s.provider);
  const setProvider = useSettingsStore((s) => s.setProvider);

  const runProviders = useRefineStore((s) => s.runProviders);
  const toggleRunProvider = useRefineStore((s) => s.toggleRunProvider);
  const plan = usePlanStore((s) => s.plan);
  const planMeta = PLANS[plan];

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
              assistants you pick in Refine. Assistants are provided by Orire.
            </span>
          </div>
          <div className="conn-switch" role="tablist" aria-label="Default assistant">
            {PROVIDER_IDS.map((p) => {
              const active = p === defaultProvider;
              return (
                <button
                  key={p}
                  role="tab"
                  aria-selected={active}
                  className={`conn-switch-opt${active ? " on" : ""}`}
                  onClick={() => setProvider(p)}
                >
                  <span className={`conn-dot ${p}`} />
                  {PROVIDERS[p].label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="conn-grid">
      {PROVIDER_IDS.map((p, i) => {
        const meta = PROVIDERS[p];
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
              ) : isDefault ? (
                <span className="conn-ok">Ready</span>
              ) : (
                <button className="conn-setdefault" onClick={() => setProvider(p)} title="Use as default assistant">
                  Set default
                </button>
              )}
            </div>

            <div className="conn-field">
              <span className="ed-label">Quality</span>
              <div className="conn-quality">
                <span className="conn-quality-dot" aria-hidden />
                <span className="conn-quality-name">{planQualityLabel(plan)}</span>
                <span className="conn-hint">included with {planMeta.label}</span>
              </div>
            </div>
          </motion.div>
        );
      })}
      </div>
    </div>
  );
}
