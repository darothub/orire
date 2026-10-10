"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Cookie-consent state for non-essential tracking (analytics + advertising).
 * Opt-in by default: nothing beyond strictly necessary cookies loads until the
 * visitor accepts. The choice is persisted per browser; `reopen` clears it so
 * the banner can be shown again ("withdraw consent at any time").
 *
 * Backed by a module-level store read through useSyncExternalStore so there is
 * no setState-in-effect and no SSR/client hydration mismatch: the server (and
 * first client render) sees `ready === false`, then React re-renders with the
 * stored choice once hydrated.
 */
export type ConsentChoice = "granted" | "denied";

const STORAGE_KEY = "orire-consent";
const listeners = new Set<() => void>();

function readStored(): ConsentChoice | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

function write(choice: ConsentChoice | null): void {
  try {
    if (choice === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Best-effort; listeners still fire so this session reflects the choice.
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

interface ConsentValue {
  /** null = no choice made yet. */
  consent: ConsentChoice | null;
  /** True once hydrated on the client (avoids an SSR flash of the banner). */
  ready: boolean;
  setConsent: (choice: ConsentChoice) => void;
  reopen: () => void;
}

export function useConsent(): ConsentValue {
  const consent = useSyncExternalStore(subscribe, readStored, () => null);
  // false during SSR and the first client render, true after hydration.
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const setConsent = useCallback((choice: ConsentChoice) => write(choice), []);
  const reopen = useCallback(() => write(null), []);
  return { consent, ready, setConsent, reopen };
}
