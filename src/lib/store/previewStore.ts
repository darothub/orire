"use client";

import { create } from "zustand";

const MIN = 0.5;
const MAX = 1.5;
const clamp = (n: number) => Math.min(MAX, Math.max(MIN, Math.round(n * 100) / 100));

interface PreviewState {
  zoom: number;
  showGuides: boolean;
  /** Zoom that makes the paper fit the stage width — kept fresh on resize. */
  fitZoom: number;
  setZoom: (z: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fit: () => void;
  setFitZoom: (z: number) => void;
  toggleGuides: () => void;
}

/** Live-preview viewport controls: zoom level + A4 page-break guides. Kept out
 *  of the persisted CV/style stores since it's an ephemeral viewing preference. */
export const usePreviewStore = create<PreviewState>((set, get) => ({
  zoom: 1,
  showGuides: true,
  fitZoom: 1,
  setZoom: (z) => set({ zoom: clamp(z) }),
  zoomIn: () => set({ zoom: clamp(get().zoom + 0.1) }),
  zoomOut: () => set({ zoom: clamp(get().zoom - 0.1) }),
  resetZoom: () => set({ zoom: 1 }),
  fit: () => set({ zoom: get().fitZoom }),
  setFitZoom: (z) => set({ fitZoom: clamp(z) }),
  toggleGuides: () => set((s) => ({ showGuides: !s.showGuides })),
}));

export const PREVIEW_ZOOM = { MIN, MAX };
