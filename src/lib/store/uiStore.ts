"use client";

import { create } from "zustand";

interface UIState {
  /** When true, text on the live preview (right pane) is directly editable (req 10/11). */
  previewEdit: boolean;
  setPreviewEdit: (v: boolean) => void;
  togglePreviewEdit: () => void;
}

/** Ephemeral UI flags — intentionally NOT persisted. */
export const useUIStore = create<UIState>((set) => ({
  previewEdit: false,
  setPreviewEdit: (v) => set({ previewEdit: v }),
  togglePreviewEdit: () => set((s) => ({ previewEdit: !s.previewEdit })),
}));
