"use client";

import { create } from "zustand";

/**
 * Shared run coordinator (finding #1).
 *
 * Every AI action used to own private, local run state, so the same logical
 * operation could fire twice from two sections at once — e.g. a Simulate kicked
 * off inside Refine left the standalone Simulate section's button clickable, and
 * both requests raced on the shared targetStore (last-writer-wins).
 *
 * This store is a tiny inflight registry keyed by an *operation class* (e.g.
 * "simulate", "judge", "retone"). It gives us two guarantees:
 *   1. Mutual exclusion + visibility — `active[kind]` is set for the lifetime of
 *      a run, so any subscribed UI can disable a duplicate trigger and show who
 *      started it.
 *   2. Shared result — `sharedRun` dedupes concurrent calls of the same kind:
 *      the second caller awaits the first caller's in-flight promise instead of
 *      firing a second request.
 *
 * Parallelism that is *intended* (one Refine column per provider) is keyed
 * per-provider ("refine:openai"), so distinct providers never block each other.
 */

export interface RunMeta {
  /** Epoch ms the run began. */
  startedAt: number;
  /** Human label for where the run was triggered from ("Refine", "Simulate"…). */
  origin: string;
}

interface RunState {
  /** Map of operation class → metadata while it is in flight. */
  active: Record<string, RunMeta>;
  begin: (kind: string, origin: string) => void;
  end: (kind: string) => void;
}

export const useRunStore = create<RunState>((set) => ({
  active: {},
  begin: (kind, origin) =>
    set((s) => (s.active[kind] ? s : { active: { ...s.active, [kind]: { startedAt: Date.now(), origin } } })),
  end: (kind) =>
    set((s) => {
      if (!s.active[kind]) return s;
      const next = { ...s.active };
      delete next[kind];
      return { active: next };
    }),
}));

/** Module-level promise registry for shared-result dedupe (not reactive state). */
const inflight = new Map<string, Promise<unknown>>();

/**
 * Run a deduplicated operation keyed by `kind`. If an operation of the same
 * kind is already in flight, the existing promise is returned (shared result)
 * and `fn` is never invoked — so two sections triggering the "same" event
 * resolve from a single request. The reactive `active[kind]` flag is held for
 * the full lifetime so subscribed UI can reflect the run everywhere.
 */
export async function sharedRun<T>(kind: string, origin: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(kind);
  if (existing) return existing as Promise<T>;

  useRunStore.getState().begin(kind, origin);
  const p = (async () => {
    try {
      return await fn();
    } finally {
      inflight.delete(kind);
      useRunStore.getState().end(kind);
    }
  })();
  inflight.set(kind, p);
  return p as Promise<T>;
}

/** True when another caller already owns an in-flight run of this kind. */
export function isRunActive(kind: string): boolean {
  return Boolean(useRunStore.getState().active[kind]);
}

/** Reactive hook: is an operation of this kind currently in flight? */
export function useIsRunning(kind: string): boolean {
  return useRunStore((s) => Boolean(s.active[kind]));
}

/** Reactive hook: where was the in-flight run of this kind started from? */
export function useRunOrigin(kind: string): string | undefined {
  return useRunStore((s) => s.active[kind]?.origin);
}
