"use client";

import { create } from "zustand";

/** localStorage key recording that the first-run tour has been completed or
 *  skipped, so it never auto-opens again for a returning user on this device. */
export const ONBOARDING_KEY = "orire-onboarded";

function markSeen() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    /* private mode / storage disabled — the tour simply re-shows next visit */
  }
}

/** True once the user has finished or skipped the guided tour on this device. */
export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return true; // fail closed: never nag if we can't read the flag
  }
}

interface OnboardingState {
  /** Whether the spotlight tour is currently on screen. */
  active: boolean;
  /** Zero-based index of the current step. */
  step: number;
  /** Open the tour at the first step (used on first login and manual replay). */
  start: () => void;
  next: () => void;
  back: () => void;
  goTo: (i: number) => void;
  /** Close the tour. Pass `seen` (default true) to persist that it was shown so
   *  it won't auto-open again; a transient close can pass false. */
  stop: (seen?: boolean) => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  active: false,
  step: 0,
  start: () => set({ active: true, step: 0 }),
  next: () => set((s) => ({ step: s.step + 1 })),
  back: () => set((s) => ({ step: Math.max(0, s.step - 1) })),
  goTo: (i) => set({ step: Math.max(0, i) }),
  stop: (seen = true) => {
    if (seen) markSeen();
    set({ active: false, step: 0 });
  },
}));
