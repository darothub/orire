"use client";

import { useRefineStore } from "@/lib/store/refineStore";
import { useSettingsStore } from "@/lib/store/settingsStore";
import { ProviderSetup } from "@/components/ai/ProviderSetup";
import { PROVIDERS, needsKey } from "@/lib/ai/types";

export function ConnectStep({ onNext }: { onNext: () => void }) {
  const runProviders = useRefineStore((s) => s.runProviders);
  const keys = useSettingsStore((s) => s.keys);
  const selectedMissingKey = runProviders.filter((p) => needsKey(p) && !keys[p]?.trim());
  const ready = runProviders.length >= 1 && selectedMissingKey.length === 0;

  return (
    <div className="step-body">
      <p className="step-hint">
        Select <strong>one</strong> assistant for a single tailored pass, or <strong>two</strong> to run them in
        parallel and compare. Keys stay in this browser and go only to the provider you pick.
      </p>
      <ProviderSetup selectable />
      <div className="step-nav">
        <span className="step-note">
          {runProviders.length === 0
            ? "Select at least one assistant to continue."
            : selectedMissingKey.length > 0
              ? `Add a key for ${selectedMissingKey.map((p) => PROVIDERS[p].label).join(" & ")}.`
              : runProviders.length === 1
                ? "1 assistant — single tailored pass."
                : "2 assistants — parallel compare + judge."}
        </span>
        <button className="flow-btn primary" onClick={onNext} disabled={!ready}>Continue</button>
      </div>
    </div>
  );
}
