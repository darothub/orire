"use client";

import { create } from "zustand";

/** Cloud autosave status for the signed-in user's working CV. */
export type SyncStatus = "idle" | "saving" | "saved" | "error";

interface SyncState {
  status: SyncStatus;
  setStatus: (status: SyncStatus) => void;
}

/** Not persisted — reflects the live autosave state only for this session. */
export const useSyncStore = create<SyncState>((set) => ({
  status: "idle",
  setStatus: (status) => set({ status }),
}));
