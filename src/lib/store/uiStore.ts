"use client";

import { create } from "zustand";

interface UIState {
  /** When true, text on the live preview (right pane) is directly editable (req 10/11). */
  previewEdit: boolean;
  setPreviewEdit: (v: boolean) => void;
  togglePreviewEdit: () => void;
  /** Which pane is visible on narrow (phone/tablet) viewports, where the editor
   *  and the live preview can't sit side-by-side. Ignored on wide screens. */
  mobilePane: "work" | "preview";
  setMobilePane: (v: "work" | "preview") => void;
  /** Full-screen login / sign-up overlay. `authMode` seeds which tab opens. */
  authOpen: boolean;
  authMode: "signin" | "signup";
  openAuth: (mode?: "signin" | "signup") => void;
  closeAuth: () => void;
  /** User chose "Explore without an account" (mirrors the persisted localStorage
   *  flag). While false and not signed in, the main workspace stays gated behind
   *  the login page so the landing never flashes first. */
  explored: boolean;
  setExplored: (v: boolean) => void;
}

/** Ephemeral UI flags — intentionally NOT persisted. */
export const useUIStore = create<UIState>((set) => ({
  previewEdit: false,
  setPreviewEdit: (v) => set({ previewEdit: v }),
  togglePreviewEdit: () => set((s) => ({ previewEdit: !s.previewEdit })),
  mobilePane: "work",
  setMobilePane: (v) => set({ mobilePane: v }),
  authOpen: false,
  authMode: "signin",
  openAuth: (mode = "signin") => set({ authOpen: true, authMode: mode }),
  closeAuth: () => set({ authOpen: false }),
  explored: false,
  setExplored: (v) => set({ explored: v }),
}));
