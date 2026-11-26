"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const KEY_PREFIX = "orire.v4.collapsed.";

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function read(key: string): boolean {
  try { return localStorage.getItem(KEY_PREFIX + key) === "1"; } catch { return false; }
}

/**
 * A panel's collapsed state, remembered per device. False on the server and
 * during hydration, so the first paint matches the server HTML.
 */
export function useCollapsed(key: string): [boolean, () => void] {
  const collapsed = useSyncExternalStore(subscribe, () => read(key), () => false);
  const toggle = useCallback(() => {
    try { localStorage.setItem(KEY_PREFIX + key, read(key) ? "0" : "1"); } catch { /* private mode: not remembered */ }
    listeners.forEach((cb) => cb());
  }, [key]);
  return [collapsed, toggle];
}
