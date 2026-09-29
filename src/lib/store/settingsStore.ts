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
      keys: { openai: "", anthropic: "" },
      models: {
        openai: PROVIDERS.openai.defaultModel,
        anthropic: PROVIDERS.anthropic.defaultModel,
      },
      setProvider: (p) => set({ provider: p }),
      setKey: (p, key) => set((s) => ({ keys: { ...s.keys, [p]: key } })),
      setModel: (p, model) => set((s) => ({ models: { ...s.models, [p]: model } })),
    }),
    { name: "orire-settings-v1" }
  )
);
