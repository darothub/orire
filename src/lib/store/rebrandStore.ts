"use client";

import { create } from "zustand";
import type { CVData } from "@/lib/cv/schema";


/**
 * Re-brand draft state (req 3). Holds a restructured CV produced from an
 * uploaded document plus the template the user is auditioning for it, kept
 * entirely separate from the working CV so the output can be previewed in any
 * template before it is committed. Not persisted — a draft is transient.
 */
interface RebrandState {
  draft: CVData | null;
  /** The user's uploaded CV as first parsed — the true "initial" for rating. */
  original: CVData | null;
  sourceName: string | null;
  /** How the draft was produced, shown back to the user for transparency. */
  via: string | null;
  /** Confidence notes from the parse — the "check this" review step shows
   *  these on the final preview, right before the user commits. */
  notes: string[];
  templateId: string;
  setDraft: (draft: CVData, sourceName: string, via: string, original?: CVData, notes?: string[]) => void;
  setTemplate: (id: string) => void;
  reset: () => void;
}

export const useRebrandStore = create<RebrandState>((set) => ({
  draft: null,
  original: null,
  sourceName: null,
  via: null,
  notes: [],
  templateId: "aurora",
  setDraft: (draft, sourceName, via, original, notes) =>
    set({ draft, original: original ?? draft, sourceName, via, notes: notes ?? [] }),
  setTemplate: (templateId) => set({ templateId }),
  reset: () => set({ draft: null, original: null, sourceName: null, via: null, notes: [], templateId: "aurora" }),
}));
