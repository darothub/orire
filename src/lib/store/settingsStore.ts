"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PROVIDERS, type ProviderId } from "@/lib/ai/types";

interface SettingsState {
  provider: ProviderId;
  /** Per-provider API keys (BYO). Stored in localStorage only. */
  keys: Record<ProviderId, string>;
  /** Per-provider selected model. */
  models: Record<ProviderId, string>;

  setProvider: (p: ProviderId) => void;
  setKey: (p: ProviderId, key: string) => void;
  setModel: (p: ProviderId, model: string) => void;
}

const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];
const blankKeys = (): Record<ProviderId, string> =>
  Object.fromEntries(PROVIDER_IDS.map((p) => [p, ""])) as Record<ProviderId, string>;
const defaultModels = (): Record<ProviderId, string> =>
  Object.fromEntries(PROVIDER_IDS.map((p) => [p, PROVIDERS[p].defaultModel])) as Record<ProviderId, string>;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      provider: "openai",
      keys: blankKeys(),
      models: defaultModels(),
      setProvider: (p) => set({ provider: p }),
      setKey: (p, key) => set((s) => ({ keys: { ...s.keys, [p]: key } })),
      setModel: (p, model) => set((s) => ({ models: { ...s.models, [p]: model } })),
    }),
    {
      name: "orire-settings-v1",
      version: 1,
      // Drop a stale forced Codex model (gpt-5-codex) persisted before we
      // switched CLI providers to the assistant's own default. Without this, a
      // returning user keeps sending an unsupported model on ChatGPT-plan logins.
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Partial<SettingsState>;
        if (version < 1 && s.models && s.models["codex-cli"] === "gpt-5-codex") {
          s.models = { ...s.models, "codex-cli": "" };
        }
        return s as SettingsState;
      },
      // Deep-merge so providers added after a user first persisted (e.g. the CLI
      // connection) are backfilled with their defaults instead of coming back
      // undefined.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          ...p,
          keys: { ...current.keys, ...(p.keys ?? {}) },
          models: { ...current.models, ...(p.models ?? {}) },
        };
      },
    }
  )
);
