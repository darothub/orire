"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CVData } from "@/lib/cv/schema";

/**
 * orire — CV version library (Story 1, client-first).
 *
 * Replaces the old export-only "History" log with a real multi-CV library:
 * named versions a user saves as they tailor a master CV to different roles.
 * Each version is a full, self-contained snapshot (CVData + baseline +
 * template) so it can be reopened as the working CV at any time. Persisted to
 * localStorage for now; cloud persistence (real Document rows) is a follow-up.
 */
export interface CvVersion {
  id: string;
  /** User-facing name, e.g. "Backend — Stripe". */
  name: string;
  /** Company/role this variant targets — the grouping key. */
  company: string;
  /** Candidate name from the CV, for display. */
  person: string;
  /** Template id in use when the version was saved. */
  template: string;
  /** Full CV snapshot. */
  cv: CVData;
  /** Rating baseline snapshot, so Grade still works after reopening. */
  baseline: CVData | null;
  createdAt: number;
  updatedAt: number;
  /** Last time this exact version was exported (PDF/Word), if ever. */
  lastExportedAt?: number;
}

/** Fallback grouping label when no company was given. */
export const UNFILED = "Unfiled";

export interface SaveVersionInput {
  name: string;
  company: string;
  person: string;
  template: string;
  cv: CVData;
  baseline: CVData | null;
  /** Mark the new version as just-exported (used by the export flow). */
  exported?: boolean;
}

interface LibraryState {
  versions: CvVersion[];
  /** The version currently loaded in the editor, for an "active" badge. */
  activeId: string | null;
  /** Last company the user filed under, to prefill dialogs. */
  lastCompany: string;

  /** Save the current CV as a new named version; returns the new id. */
  saveVersion: (input: SaveVersionInput) => string;
  /** Rename a version. */
  rename: (id: string, name: string) => void;
  /** Re-file a version under a different company. */
  refile: (id: string, company: string) => void;
  /** Clone a version as a new "(copy)". */
  duplicate: (id: string) => string | null;
  /** Mark which version is loaded in the editor. */
  markActive: (id: string | null) => void;
  remove: (id: string) => void;
  clear: () => void;
}

function uid(): string {
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      versions: [],
      activeId: null,
      lastCompany: "",

      saveVersion: (input) => {
        const id = uid();
        const now = Date.now();
        const version: CvVersion = {
          id,
          name: input.name.trim() || input.cv.basics.fullName || "Untitled version",
          company: input.company.trim(),
          person: input.person.trim(),
          template: input.template,
          cv: input.cv,
          baseline: input.baseline,
          createdAt: now,
          updatedAt: now,
          ...(input.exported ? { lastExportedAt: now } : {}),
        };
        set((s) => ({
          versions: [version, ...s.versions].slice(0, 200),
          activeId: id,
          lastCompany: input.company.trim() || s.lastCompany,
        }));
        return id;
      },

      rename: (id, name) =>
        set((s) => ({
          versions: s.versions.map((v) =>
            v.id === id ? { ...v, name: name.trim() || v.name, updatedAt: Date.now() } : v,
          ),
        })),

      refile: (id, company) =>
        set((s) => ({
          versions: s.versions.map((v) =>
            v.id === id ? { ...v, company: company.trim(), updatedAt: Date.now() } : v,
          ),
          lastCompany: company.trim() || s.lastCompany,
        })),

      duplicate: (id) => {
        const src = get().versions.find((v) => v.id === id);
        if (!src) return null;
        const newId = uid();
        const now = Date.now();
        const copy: CvVersion = {
          ...src,
          id: newId,
          name: `${src.name} (copy)`,
          createdAt: now,
          updatedAt: now,
          lastExportedAt: undefined,
        };
        set((s) => ({ versions: [copy, ...s.versions].slice(0, 200) }));
        return newId;
      },

      markActive: (id) => set({ activeId: id }),

      remove: (id) =>
        set((s) => ({
          versions: s.versions.filter((v) => v.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        })),

      clear: () => set({ versions: [], activeId: null }),
    }),
    { name: "orire-library-v1" },
  ),
);

/** Group versions by company (newest-updated first within each group), Unfiled last. */
export function groupByCompany(versions: CvVersion[]): { company: string; items: CvVersion[] }[] {
  const map = new Map<string, CvVersion[]>();
  for (const v of versions) {
    const key = v.company.trim() || UNFILED;
    (map.get(key) ?? map.set(key, []).get(key)!).push(v);
  }
  const groups = [...map.entries()].map(([company, items]) => ({
    company,
    items: items.sort((a, b) => b.updatedAt - a.updatedAt),
  }));
  groups.sort((a, b) => {
    if (a.company === UNFILED) return 1;
    if (b.company === UNFILED) return -1;
    return (b.items[0]?.updatedAt ?? 0) - (a.items[0]?.updatedAt ?? 0);
  });
  return groups;
}
