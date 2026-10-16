"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CVData } from "@/lib/cv/schema";
import { useCVStore } from "@/lib/store/cvStore";
import {
  listVersions,
  createVersion,
  updateVersionMeta,
  duplicateVersion,
  deleteVersion,
  setActiveVersion,
  markVersionExported,
  type LibraryVersion,
} from "@/app/actions/library";

/**
 * orire — CV version library.
 *
 * Two backends behind one façade:
 *  - signed out → local snapshots in localStorage (Story 1);
 *  - signed in  → real `Document` rows via the server actions (Story 2). The
 *    `cloud` flag (set by CloudSync) routes every mutation; the store's
 *    `versions`/`activeId` remain the single render source in both modes, so
 *    the UI never branches on backend.
 *
 * The active version is the one open in the editor and the autosave target
 * (server pointer `User.activeDocumentId`). On activate we set that pointer
 * *before* loading the CV into the editor, so the debounced autosave can never
 * write the newly-loaded CV back to the previously-active row.
 */
export interface CvVersion {
  id: string;
  name: string;
  company: string;
  person: string;
  template: string;
  cv: CVData;
  baseline: CVData | null;
  createdAt: number;
  updatedAt: number;
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
  exported?: boolean;
}

interface LibraryState {
  versions: CvVersion[];
  activeId: string | null;
  lastCompany: string;
  /** True when server-backed (signed in). */
  cloud: boolean;
  loading: boolean;

  /** Switch to cloud mode and load versions from the server. */
  refreshFromCloud: () => Promise<void>;
  /** Switch to local mode (keeps the in-memory/local versions). */
  goLocal: () => void;

  saveVersion: (input: SaveVersionInput) => Promise<string | null>;
  rename: (id: string, name: string) => Promise<void>;
  refile: (id: string, company: string) => Promise<void>;
  duplicate: (id: string) => Promise<string | null>;
  remove: (id: string) => Promise<void>;
  /** Load a version into the editor and make it the active/autosave target. */
  activate: (id: string) => Promise<void>;
  /** Called from the export flow: mark the active version exported, or file a
   *  new one when there's no active version yet. */
  recordExport: (input: SaveVersionInput) => Promise<void>;
  /** Wipe in-memory state (sign-out). Never deletes server rows. */
  clear: () => void;
}

function uid(): string {
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function fromServer(v: LibraryVersion): CvVersion {
  return {
    id: v.id,
    name: v.title,
    company: v.company ?? "",
    person: (v.data.basics.fullName ?? "").trim(),
    template: v.template,
    cv: v.data,
    baseline: v.baseline,
    createdAt: new Date(v.createdAt).getTime(),
    updatedAt: new Date(v.updatedAt).getTime(),
    lastExportedAt: v.lastExportedAt ? new Date(v.lastExportedAt).getTime() : undefined,
  };
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      versions: [],
      activeId: null,
      lastCompany: "",
      cloud: false,
      loading: false,

      refreshFromCloud: async () => {
        set({ loading: true, cloud: true });
        try {
          const { versions, activeId } = await listVersions();
          set({ versions: versions.map(fromServer), activeId, loading: false });
        } catch {
          set({ loading: false });
        }
      },

      goLocal: () => set({ cloud: false }),

      saveVersion: async (input) => {
        if (get().cloud) {
          const res = await createVersion({
            title: input.name,
            company: input.company,
            template: input.template,
            data: input.cv,
            baseline: input.baseline,
            exported: input.exported,
            makeActive: true,
          });
          if (!res.ok) return null;
          set({ lastCompany: input.company.trim() || get().lastCompany });
          await get().refreshFromCloud();
          return res.id;
        }
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

      rename: async (id, name) => {
        if (get().cloud) {
          await updateVersionMeta(id, { title: name });
          await get().refreshFromCloud();
          return;
        }
        set((s) => ({
          versions: s.versions.map((v) =>
            v.id === id ? { ...v, name: name.trim() || v.name, updatedAt: Date.now() } : v,
          ),
        }));
      },

      refile: async (id, company) => {
        if (get().cloud) {
          await updateVersionMeta(id, { company });
          set({ lastCompany: company.trim() || get().lastCompany });
          await get().refreshFromCloud();
          return;
        }
        set((s) => ({
          versions: s.versions.map((v) =>
            v.id === id ? { ...v, company: company.trim(), updatedAt: Date.now() } : v,
          ),
          lastCompany: company.trim() || s.lastCompany,
        }));
      },

      duplicate: async (id) => {
        if (get().cloud) {
          const res = await duplicateVersion(id);
          if (!res.ok) return null;
          await get().refreshFromCloud();
          return res.id;
        }
        const src = get().versions.find((v) => v.id === id);
        if (!src) return null;
        const newId = uid();
        const now = Date.now();
        const copy: CvVersion = { ...src, id: newId, name: `${src.name} (copy)`, createdAt: now, updatedAt: now, lastExportedAt: undefined };
        set((s) => ({ versions: [copy, ...s.versions].slice(0, 200) }));
        return newId;
      },

      remove: async (id) => {
        if (get().cloud) {
          await deleteVersion(id);
          await get().refreshFromCloud();
          return;
        }
        set((s) => ({
          versions: s.versions.filter((v) => v.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        }));
      },

      activate: async (id) => {
        const v = get().versions.find((x) => x.id === id);
        if (!v) return;
        // Set the server autosave pointer BEFORE loading the CV, so the
        // debounced save can't write this CV back onto the old active row.
        if (get().cloud) await setActiveVersion(id);
        useCVStore.getState().hydrateFromCloud({ cv: v.cv, template: v.template, baseline: v.baseline });
        set({ activeId: id });
      },

      recordExport: async (input) => {
        const { cloud, activeId } = get();
        // In cloud mode the active row is live-synced to the current CV, so just
        // stamp it exported. Otherwise (local, or cloud with nothing active yet)
        // file a fresh version snapshot.
        if (cloud && activeId) {
          await markVersionExported(activeId);
          await get().refreshFromCloud();
          return;
        }
        await get().saveVersion({ ...input, exported: true });
      },

      clear: () => set({ versions: [], activeId: null, cloud: false }),
    }),
    {
      name: "orire-library-v1",
      // Never cache server-backed rows in localStorage; only persist the local
      // (anonymous) library.
      partialize: (s) =>
        s.cloud
          ? { lastCompany: s.lastCompany }
          : { versions: s.versions, activeId: s.activeId, lastCompany: s.lastCompany },
    },
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
