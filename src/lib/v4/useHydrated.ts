"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False on the server and during hydration, true afterwards. The CV and library
 * stores read localStorage, so anything derived from them renders only once this
 * is true, keeping server HTML and the first client paint identical.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
