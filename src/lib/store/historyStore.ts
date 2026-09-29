"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CVData } from "@/lib/cv/schema";

/** How a CV was laid out for export/print. */
export type PageMode = "continuous" | "paged" | "fit";

export const PAGE_MODES: { id: PageMode; label: string; hint: string }[] = [
  { id: "continuous", label: "Whole length", hint: "One tall page — never breaks an entry" },
  { id: "paged", label: "Break into pages", hint: "Flow across A4 pages" },
  { id: "fit", label: "Fit to one page", hint: "Scale down to a single A4 page" },
];

export interface HistoryEntry {
  id: string;
  /** File name the user saved it under (no extension). */
  fileName: string;
  /** Company the CV was tailored to — the grouping key in History. */
  company: string;
  /** Candidate name, from the CV, for display. */
  person: string;
  /** Template id + friendly name at export time. */
  template: string;
  templateName: string;
  mode: PageMode;
  createdAt: number;
  /** Full CV snapshot so the export can be reopened later. */
  cv: CVData;
}

/** Fallback grouping label when no company was given. */
export const UNFILED = "Unfiled";

interface HistoryState {
  entries: HistoryEntry[];
  /** Last company/name the user typed, to prefill the export dialog. */
  lastCompany: string;
  add: (entry: Omit<HistoryEntry, "id" | "createdAt">) => void;
  remove: (id: string) => void;
  clear: () => void;
}

function uid(): string {
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      entries: [],
      lastCompany: "",
      add: (entry) =>
        set((s) => ({
          entries: [{ ...entry, id: uid(), createdAt: Date.now() }, ...s.entries].slice(0, 200),
          lastCompany: entry.company || s.lastCompany,
        })),
      remove: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
      clear: () => set({ entries: [] }),
    }),
    { name: "orire-history-v1" }
  )
);

/** Group entries by company (newest first within each group), Unfiled last. */
export function groupByCompany(entries: HistoryEntry[]): { company: string; items: HistoryEntry[] }[] {
  const map = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const key = e.company.trim() || UNFILED;
    (map.get(key) ?? map.set(key, []).get(key)!).push(e);
  }
  const groups = [...map.entries()].map(([company, items]) => ({
    company,
    items: items.sort((a, b) => b.createdAt - a.createdAt),
  }));
  groups.sort((a, b) => {
    if (a.company === UNFILED) return 1;
    if (b.company === UNFILED) return -1;
    return (b.items[0]?.createdAt ?? 0) - (a.items[0]?.createdAt ?? 0);
  });
  return groups;
}
