"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CVAlign = "left" | "right" | "justify";

/** A selectable typeface pairing. `sans`/`serif` override the paper's CSS font
 *  vars; `null` means "keep the template default". */
export interface FontOption {
  id: string;
  label: string;
  sans: string | null;
  serif: string | null;
}

export const FONT_OPTIONS: FontOption[] = [
  { id: "default", label: "Template default", sans: null, serif: null },
  {
    id: "modern",
    label: "Modern sans",
    sans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    serif: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  {
    id: "humanist",
    label: "Humanist",
    sans: '"Segoe UI", "Optima", "Gill Sans", sans-serif',
    serif: '"Segoe UI", "Optima", "Gill Sans", sans-serif',
  },
  {
    id: "classic",
    label: "Classic serif",
    sans: 'Georgia, "Times New Roman", serif',
    serif: 'Georgia, "Times New Roman", serif',
  },
  {
    id: "editorial",
    label: "Editorial",
    sans: 'ui-sans-serif, system-ui, sans-serif',
    serif: '"Iowan Old Style", Palatino, "Book Antiqua", Georgia, serif',
  },
  {
    id: "mono",
    label: "Monospace",
    sans: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    serif: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  },
];

/** Discrete font-size scale steps (as a CSS zoom multiplier). */
export const SIZE_STEPS = [0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.2] as const;

interface StyleState {
  fontId: string;
  /** Zoom multiplier for the whole CV (proxy for font size). */
  size: number;
  align: CVAlign;
  setFont: (id: string) => void;
  setSize: (n: number) => void;
  setAlign: (a: CVAlign) => void;
  resetStyle: () => void;
}

export function fontOption(id: string): FontOption {
  return FONT_OPTIONS.find((f) => f.id === id) ?? FONT_OPTIONS[0];
}

export const useStyleStore = create<StyleState>()(
  persist(
    (set) => ({
      fontId: "default",
      size: 1,
      align: "left",
      setFont: (fontId) => set({ fontId }),
      setSize: (size) => set({ size }),
      setAlign: (align) => set({ align }),
      resetStyle: () => set({ fontId: "default", size: 1, align: "left" }),
    }),
    { name: "orire-style-v1" }
  )
);

/** Build the inline style overrides to apply typography to the CV paper. */
export function paperStyleVars(s: { fontId: string; size: number; align: CVAlign }): React.CSSProperties {
  const f = fontOption(s.fontId);
  const style: React.CSSProperties & Record<string, string> = {};
  if (f.sans) style["--font-sans"] = f.sans;
  if (f.serif) style["--font-serif"] = f.serif;
  if (s.size !== 1) style.zoom = String(s.size);
  if (s.align !== "left") style.textAlign = s.align;
  return style;
}
