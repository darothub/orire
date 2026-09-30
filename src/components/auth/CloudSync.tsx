"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useCVStore } from "@/lib/store/cvStore";
import { usePlanStore } from "@/lib/store/planStore";
import { loadWorkingCV, saveWorkingCV } from "@/app/actions/cv";
import { readEntitlement } from "@/app/actions/refine";

/**
 * Bridges the local CV (Zustand + localStorage) with the signed-in user's cloud
 * copy. Renders nothing.
 *  - On first authentication: adopt the server copy if one exists, otherwise
 *    push the current local CV up so it becomes the user's cloud document.
 *  - While signed in: debounce-save edits to the server. localStorage remains
 *    the offline fallback, so signed-out users are unaffected.
 */
export function CloudSync() {
  const { status } = useSession();
  const hydratedFor = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt-or-seed once per authenticated session.
  useEffect(() => {
    if (status !== "authenticated" || hydratedFor.current) return;
    hydratedFor.current = true;
    let cancelled = false;
    (async () => {
      const remote = await loadWorkingCV();
      if (cancelled) return;
      const store = useCVStore.getState();
      if (remote) {
        store.hydrateFromCloud({ cv: remote.data, template: remote.template, baseline: remote.baseline });
      } else {
        await saveWorkingCV({ data: store.cv, template: store.activeTemplate, baseline: store.baseline });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  // Reset the guard on sign-out so a later sign-in re-syncs. Also drop the
  // server-authoritative plan mirror back to the free local default.
  useEffect(() => {
    if (status === "unauthenticated") {
      hydratedFor.current = false;
      usePlanStore.getState().clearServer();
    }
  }, [status]);

  // Mirror the server-truth plan + usage whenever we become authenticated, so
  // the plan UI shows the enforceable numbers (not the local trial counter).
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      const ent = await readEntitlement();
      if (cancelled || !ent) return;
      usePlanStore.getState().syncFromServer({ plan: ent.plan, usedThisMonth: ent.usedThisMonth });
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  // Debounced autosave of edits while signed in.
  useEffect(() => {
    if (status !== "authenticated") return;
    const unsub = useCVStore.subscribe((s, prev) => {
      if (s.cv === prev.cv && s.activeTemplate === prev.activeTemplate && s.baseline === prev.baseline) {
        return;
      }
      if (!hydratedFor.current) return; // don't save before the initial adopt/seed
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const st = useCVStore.getState();
        void saveWorkingCV({ data: st.cv, template: st.activeTemplate, baseline: st.baseline });
      }, 1500);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [status]);

  return null;
}
