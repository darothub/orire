"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

export const THEME_KEY = "orire-theme";
const EVT = "orire-theme-change";

/** Read the resolved theme currently applied to <html>. */
function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

/** Apply + persist a theme, and notify any other hook instances. */
export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVT, { detail: theme }));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY) onChange();
  };
  window.addEventListener(EVT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Theme state synced to <html data-theme>. The pre-paint inline script in the
 * root layout sets the initial attribute, so there is no flash; this hook reads
 * that attribute as an external store and lets components flip it.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "dark" as Theme);
  const toggle = () => applyTheme(theme === "light" ? "dark" : "light");
  return { theme, setTheme: applyTheme, toggle };
}

