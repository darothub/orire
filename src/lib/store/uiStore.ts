"use client";

import { create } from "zustand";
import type { PlanId } from "@/lib/plan/plan";

interface UIState {
  /** When true, text on the live preview (right pane) is directly editable (req 10/11). */
  previewEdit: boolean;
  setPreviewEdit: (v: boolean) => void;
  togglePreviewEdit: () => void;
  /** Which pane is visible on narrow (phone/tablet) viewports, where the editor
   *  and the live preview can't sit side-by-side. Ignored on wide screens. */
  mobilePane: "work" | "preview";
  setMobilePane: (v: "work" | "preview") => void;
  /** Full-screen login / sign-up overlay. `authMode` seeds which tab opens. */
  authOpen: boolean;
  authMode: "signin" | "signup";
  /** Plan the visitor chose on the pricing cards, carried through sign-up so the
   *  app can land them on checkout for that plan. null = no specific intent. */
  intendedPlan: PlanId | null;
  openAuth: (mode?: "signin" | "signup", plan?: PlanId | null) => void;
  closeAuth: () => void;
  clearIntendedPlan: () => void;
  /** User chose "Explore without an account" (mirrors the persisted localStorage
   *  flag). While false and not signed in, the main workspace stays gated behind
   *  the login page so the landing never flashes first. */
  explored: boolean;
  setExplored: (v: boolean) => void;
}

/** Preserve a chosen paid plan through the full-page OAuth redirect in this tab.
 * Do not persist it in localStorage across future unrelated visits. */
const PLAN_INTENT_KEY = "orire.signup.plan-intent";
export function readPendingPlanIntent(): PlanId | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(PLAN_INTENT_KEY);
    return value === "pro" || value === "career" ? value : null;
  } catch {
    return null;
  }
}

function writePendingPlanIntent(plan: PlanId | null) {
  if (typeof window === "undefined") return;
  try {
    if (plan === "pro" || plan === "career") {
      window.sessionStorage.setItem(PLAN_INTENT_KEY, plan);
    } else {
      window.sessionStorage.removeItem(PLAN_INTENT_KEY);
    }
  } catch {
    // Session storage can be unavailable in privacy-restricted browsers.
  }
}

/** Ephemeral UI flags — intentionally NOT persisted. */
export const useUIStore = create<UIState>((set) => ({
  previewEdit: false,
  setPreviewEdit: (v) => set({ previewEdit: v }),
  togglePreviewEdit: () => set((s) => ({ previewEdit: !s.previewEdit })),
  mobilePane: "work",
  setMobilePane: (v) => set({ mobilePane: v }),
  authOpen: false,
  authMode: "signin",
  intendedPlan: null,
  openAuth: (mode = "signin", plan = null) => {
    writePendingPlanIntent(plan);
    set({ authOpen: true, authMode: mode, intendedPlan: plan });
  },
  closeAuth: () => set({ authOpen: false }),
  clearIntendedPlan: () => {
    writePendingPlanIntent(null);
    set({ intendedPlan: null });
  },
  explored: false,
  setExplored: (v) => set({ explored: v }),
}));
