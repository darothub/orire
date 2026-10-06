"use client";

import { create } from "zustand";

/** The workspaces the left rail can switch between. The right pane always shows
 *  the live CV preview, so every workspace edits the same document in context. */
export type WorkspaceView = "edit" | "rebrand" | "refine" | "rate" | "target" | "cover" | "connect" | "history" | "export" | "plans" | "about";

interface ViewState {
  view: WorkspaceView;
  /** Direction hint for the pane transition (1 = forward/down, -1 = back/up). */
  dir: number;
  setView: (v: WorkspaceView) => void;
}

const ORDER: WorkspaceView[] = ["edit", "rebrand", "refine", "rate", "target", "cover", "export", "history", "plans", "connect", "about"];

export const useViewStore = create<ViewState>((set, get) => ({
  view: "edit",
  dir: 1,
  setView: (v) => {
    const cur = get().view;
    if (v === cur) return;
    const dir = ORDER.indexOf(v) >= ORDER.indexOf(cur) ? 1 : -1;
    set({ view: v, dir });
  },
}));
