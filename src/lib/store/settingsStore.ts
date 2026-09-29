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

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      provider: "openai",
      keys: { openai: "", anthropic: "", "claude-cli": "" },
      models: {
        openai: PROVIDERS.openai.defaultModel,
        anthropic: PROVIDERS.anthropic.defaultModel,
        "claude-cli": PROVIDERS["claude-cli"].defaultModel,
      },
      setProvider: (p) => set({ provider: p }),
      setKey: (p, key) => set((s) => ({ keys: { ...s.keys, [p]: key } })),
      setModel: (p, model) => set((s) => ({ models: { ...s.models, [p]: model } })),
    }),
    {
      name: "orire-settings-v1",
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
