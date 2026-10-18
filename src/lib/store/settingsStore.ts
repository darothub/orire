"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";

interface SettingsState {
  /** Default assistant to run when a single provider is used. */
  provider: ProviderId;
  /** Per-provider selected model. */
  models: Record<ProviderId, string>;

  setProvider: (p: ProviderId) => void;
  setModel: (p: ProviderId, model: string) => void;
}

const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];
const defaultModels = (): Record<ProviderId, string> =>
  Object.fromEntries(PROVIDER_IDS.map((p) => [p, PROVIDERS[p].defaultModel])) as Record<ProviderId, string>;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      provider: "openai",
      models: defaultModels(),
      setProvider: (p) => set({ provider: p }),
      setModel: (p, model) => set((s) => ({ models: { ...s.models, [p]: model } })),
    }),
    {
      name: "orire-settings-v1",
      version: 5,
      // v1 → v2: orire moved from BYO keys to managed server keys. Any
      // persisted per-provider `keys` are dropped — they are no longer read.
      // v2 → v3: the model catalog was refreshed (GPT-5 / Claude 4.5 lineup).
      // Any persisted model no longer in the catalog is dropped so `merge`
      // backfills the current default instead of sending a retired model id.
      // v3 → v4: deepSpellcheck toggle (later removed).
      // v4 → v5: drop non-contextual dictionary spellcheck setting; AI review
      // on Pro/Career handles sentence-context spelling instead.
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        delete p.keys;
        delete p.deepSpellcheck;
        const models = p.models as Record<string, unknown> | undefined;
        if (models && typeof models === "object") {
          for (const [provider, model] of Object.entries(models)) {
            const meta = PROVIDERS[provider as ProviderId];
            if (!meta || typeof model !== "string" || !meta.models.includes(model)) {
              delete models[provider];
            }
          }
        }
        return p as unknown as SettingsState;
      },
      // Deep-merge so providers added after a user first persisted are
      // backfilled with their defaults instead of coming back undefined.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState> & {
          keys?: unknown;
          deepSpellcheck?: unknown;
        };
        delete p.deepSpellcheck;
        // Guard against a stale persisted provider that no longer exists
        // (e.g. a provider removed in a later release) — fall back to default.
        const provider =
          p.provider && p.provider in PROVIDERS ? p.provider : current.provider;
        return {
          ...current,
          ...p,
          provider,
          models: { ...current.models, ...(p.models ?? {}) },
        };
      },
    }
  )
);
