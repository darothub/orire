"use client";

import { useEffect, useSyncExternalStore } from "react";
import { loadSpell, spellReady, subscribeSpell } from "./spell";

/** Starts the dictionary load and re-renders the caller once it is ready. */
export function useSpellReady(): boolean {
  useEffect(() => {
    void loadSpell();
  }, []);
  return useSyncExternalStore(subscribeSpell, spellReady, () => false);
}
