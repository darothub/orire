"use client";

import { create } from "zustand";

/** The workspaces the left rail can switch between. The right pane always shows
 *  the live CV preview, so every workspace edits the same document in context. */
export type WorkspaceView = "spotlight" | "edit" | "rebrand" | "tailor" | "refine" | "coach" | "rate" | "target" | "cover" | "connect" | "history" | "export" | "plans" | "profile" | "create";

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

const ORDER: WorkspaceView[] = ["spotlight", "create", "edit", "rebrand", "tailor", "refine", "coach", "rate", "target", "cover", "export", "history", "plans", "connect", "profile"];

export const useViewStore = create<ViewState>((set, get) => ({
  view: "spotlight",
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

const KEY = "orire:view";

/** Remember the open workspace so a browser refresh lands back on it. */
export function persistView(v: WorkspaceView): void {
  try {
    sessionStorage.setItem(KEY, v);
  } catch {}
}

export function restoreView(): WorkspaceView | null {
  try {
    const v = sessionStorage.getItem(KEY) as WorkspaceView | null;
    return v && ORDER.includes(v) && v !== "create" ? v : null;
  } catch {
    return null;
  }
}
