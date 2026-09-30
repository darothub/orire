"use client";

import { create } from "zustand";
import type { ProviderId } from "@/lib/ai/types";
import { pooledKeyProviders } from "@/app/actions/teamKeys";

/**
 * Client mirror of which providers the signed-in member's team has a pooled key
 * for (Phase B3b). Run-gating treats a pooled provider as "has a key" so seated
 * members without a personal key aren't blocked. Refreshed on connect, after
 * joining a team, and after pooled keys change.
 */
interface PooledState {
  providers: ProviderId[];
  loaded: boolean;
  has: (p: ProviderId) => boolean;
  refresh: () => Promise<void>;
  clear: () => void;
}

export const usePooledStore = create<PooledState>((set, get) => ({
  providers: [],
  loaded: false,
  has: (p) => get().providers.includes(p),
  refresh: async () => {
    try {
      const providers = await pooledKeyProviders();
      set({ providers, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  clear: () => set({ providers: [], loaded: false }),
}));
