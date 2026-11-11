"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  mergeFacts,
  recordAnswers,
  removeFact,
  sanitizeFacts,
  type AnswerInput,
  type Fact,
} from "@/lib/tailor/facts";

interface FactState {
  facts: Fact[];
  /** Bumped on every local change so CloudSync knows to save. */
  rev: number;
  record: (inputs: AnswerInput[], job: string) => void;
  remove: (id: string) => void;
  clearAll: () => void;
  /** Merge in the cloud copy (never replaces local-only facts). */
  adopt: (remote: Fact[]) => void;
  reset: () => void;
}

export const useFactStore = create<FactState>()(
  persist(
    (set) => ({
      facts: [],
      rev: 0,
      record: (inputs, job) =>
        set((s) => {
          const next = recordAnswers(s.facts, inputs, job, Date.now());
          return JSON.stringify(next) === JSON.stringify(s.facts) ? s : { facts: next, rev: s.rev + 1 };
        }),
      remove: (id) => set((s) => ({ facts: removeFact(s.facts, id, Date.now()), rev: s.rev + 1 })),
      clearAll: () =>
        set((s) => {
          const now = Date.now();
          const next = s.facts.reduce((acc, f) => (f.deleted ? acc : removeFact(acc, f.id, now)), s.facts);
          return { facts: next, rev: s.rev + 1 };
        }),
      adopt: (remote) => set((s) => ({ facts: mergeFacts(s.facts, remote) })),
      reset: () => set({ facts: [], rev: 0 }),
    }),
    {
      // Anonymous default; StorageScope rebinds per signed-in user id.
      name: "orire-facts:anon:v1",
      version: 1,
      partialize: (s) => ({ facts: s.facts }),
      merge: (persisted, current) => ({
        ...current,
        facts: sanitizeFacts((persisted as { facts?: unknown } | undefined)?.facts),
      }),
    },
  ),
);
