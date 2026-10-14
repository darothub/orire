"use client";

import { create } from "zustand";

/** The workspaces the left rail can switch between. The right pane always shows
 *  the live CV preview, so every workspace edits the same document in context. */
export type WorkspaceView = "edit" | "rebrand" | "refine" | "rate" | "target" | "cover" | "connect" | "history" | "export" | "plans" | "profile";

/** Optional section to scroll/focus once a view mounts (e.g. open the Plans
 *  view straight at its billing controls vs. its plan cards). */
export type ViewFocus = "plans" | "billing" | null;

interface ViewState {
  view: WorkspaceView;
  /** Direction hint for the pane transition (1 = forward/down, -1 = back/up). */
  dir: number;
  /** A sub-section the target view should bring into focus on arrival. */
  focus: ViewFocus;
  setView: (v: WorkspaceView, focus?: ViewFocus) => void;
  clearFocus: () => void;
}

const ORDER: WorkspaceView[] = ["edit", "rebrand", "refine", "rate", "target", "cover", "export", "history", "plans", "connect", "profile"];

export const useViewStore = create<ViewState>((set, get) => ({
  view: "edit",
  dir: 1,
  focus: null,
  setView: (v, focus = null) => {
    const cur = get().view;
    if (v === cur) {
      set({ focus });
      return;
    }
    const dir = ORDER.indexOf(v) >= ORDER.indexOf(cur) ? 1 : -1;
    set({ view: v, dir, focus });
  },
  clearFocus: () => set({ focus: null }),
}));
