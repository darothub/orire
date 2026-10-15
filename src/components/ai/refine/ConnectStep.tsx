"use client";

import { useRefineStore } from "@/lib/store/refineStore";
import { ProviderSetup } from "@/components/ai/ProviderSetup";

export function ConnectStep({ onNext }: { onNext: () => void }) {
  const runProviders = useRefineStore((s) => s.runProviders);
  const ready = runProviders.length >= 1;

  return (
    <div className="step-body">
      <p className="step-hint">
        Select <strong>one</strong> assistant for a single tailored pass, or <strong>two</strong> to run them in
        parallel and compare. Assistants are provided by Orire.
      </p>
      <ProviderSetup selectable />
      <div className="step-nav">
        <span className="step-note">
          {runProviders.length === 0
            ? "Select at least one assistant to continue."
            : runProviders.length === 1
              ? "1 assistant — single tailored pass."
              : "2 assistants — parallel compare + pick the best."}
        </span>
        <button className="flow-btn primary" onClick={onNext} disabled={!ready}>Continue</button>
      </div>
    </div>
  );
}
