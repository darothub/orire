"use client";

import { motion } from "framer-motion";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { useRefineStore } from "@/lib/store/refineStore";
import { usePlanStore } from "@/lib/store/planStore";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";
import { PLANS, providerCountAllowed, providerAllowedOnPlan, planQualityLabel } from "@/lib/plan/plan";

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
              : "ChatGPT only on Free. Upgrade to Pro to add Claude and compare two side by side."}
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
              const gate = providerAllowedOnPlan(plan, p);
              return (
                <button
                  key={p}
                  role="tab"
                  aria-selected={active}
                  className={`conn-switch-opt${active ? " on" : ""}`}
                  onClick={() => gate.allowed && setProvider(p)}
                  disabled={!gate.allowed}
                  title={gate.allowed ? undefined : gate.reason}
                >
                  <span className={`conn-dot ${p}`} />
                  {PROVIDERS[p].label}
                  {!gate.allowed && <span className="conn-tag pro">Pro</span>}
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
                  const provGate = providerAllowedOnPlan(plan, p);
                  const countGate = providerCountAllowed(plan, runProviders.length + 1);
                  const lockedByPlan = !provGate.allowed && !selected;
                  const atLimit = !selected && !countGate.allowed;
                  const disabled = lockedByPlan || atLimit;
                  const reason = lockedByPlan ? provGate.reason : atLimit ? countGate.reason : undefined;
                  return (
                    <button
                      className={`conn-select${selected ? " on" : ""}`}
                      onClick={() => !disabled && toggleRunProvider(p)}
                      aria-pressed={selected}
                      disabled={disabled}
                      title={reason}
                    >
                      {selected ? "Selected" : lockedByPlan ? "Pro" : atLimit ? "Locked" : "Select"}
                    </button>
                  );
                })()
              ) : isDefault ? (
                <span className="conn-ok">Ready</span>
              ) : (() => {
                // Setting a blocked assistant (e.g. Claude on Free) as the
                // default is gated too — not just the Refine selector and the
                // tab switch — so there's no back door to a Pro-only assistant.
                const gate = providerAllowedOnPlan(plan, p);
                return (
                  <button
                    className="conn-setdefault"
                    onClick={() => gate.allowed && setProvider(p)}
                    disabled={!gate.allowed}
                    title={gate.allowed ? "Use as default assistant" : gate.reason}
                  >
                    {gate.allowed ? "Set default" : "Pro"}
                  </button>
                );
              })()}
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
