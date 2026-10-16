"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useCVStore } from "@/lib/store/cvStore";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { usePlanStore } from "@/lib/store/planStore";
import { useUsageStore } from "@/lib/store/usageStore";
import { useSyncStore } from "@/lib/store/syncStore";
import { loadWorkingCV, saveWorkingCV } from "@/app/actions/cv";
import { isSampleCV } from "@/lib/cv/sample";
import { readEntitlement } from "@/app/actions/refine";

/**
 * Bridges the local CV (Zustand + localStorage) with the signed-in user's cloud
 * copy. Renders nothing.
 *  - On first authentication: adopt the server copy if one exists, otherwise
 *    push the current local CV up so it becomes the user's cloud document.
 *  - While signed in: debounce-save edits to the server, with a status
 *    indicator + one retry.
 *  - On sign-out: clear the local CV + history so a different account on the
 *    same browser never inherits the previous user's data.
 */
export function CloudSync() {
  const { status } = useSession();
  const hydratedFor = useRef(false);
  // Saves stay OFF until the initial adopt/seed has fully completed, so an edit
  // (or the hydrate itself) during the async load can't overwrite the cloud
  // copy with stale local state.
  const savesReady = useRef(false);
  const prevStatus = useRef<typeof status | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt-or-seed once per authenticated session. savesReady flips true only
  // after this resolves.
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
      } else if (!isSampleCV(store.cv)) {
        // Seed the cloud only with a CV the user has actually made theirs. Never
        // persist the untouched demo persona (Ada Okonkwo, @example.com) as a
        // real signed-in document — the placeholder stays a local preview, and
        // the user's first real edit or upload creates their cloud doc via
        // autosave below.
        await saveWorkingCV({ data: store.cv, template: store.activeTemplate, baseline: store.baseline });
        if (cancelled) return;
      }
      // Only now are edits allowed to flow back to the server.
      savesReady.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  // Track sign-out. On the authenticated -> unauthenticated transition (a real
  // sign-out, not an anonymous visitor's first load) wipe local CV + history so
  // the next account on this browser starts clean. Always drop the server plan
  // mirror and re-arm the sync guards.
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = status;
    if (status === "unauthenticated") {
      hydratedFor.current = false;
      savesReady.current = false;
      usePlanStore.getState().clearServer();
      useUsageStore.getState().setSummary(null);
      if (was === "authenticated") {
        useCVStore.getState().reset();
        useLibraryStore.getState().clear();
        useSyncStore.getState().setStatus("idle");
      }
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
      // Hydrate the per-metric usage mirror that drives feature grey-out.
      void useUsageStore.getState().refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  // Debounced autosave of edits while signed in, with status + a single retry.
  useEffect(() => {
    if (status !== "authenticated") return;

    const runSave = async () => {
      useSyncStore.getState().setStatus("saving");
      const snapshot = () => {
        const st = useCVStore.getState();
        return { data: st.cv, template: st.activeTemplate, baseline: st.baseline };
      };
      let res = await saveWorkingCV(snapshot());
      if (!res.ok) {
        // One retry after a short backoff for a transient failure, re-reading
        // the latest state so we never persist an older snapshot.
        await new Promise((r) => setTimeout(r, 1200));
        res = await saveWorkingCV(snapshot());
      }
      useSyncStore.getState().setStatus(res.ok ? "saved" : "error");
    };

    const unsub = useCVStore.subscribe((s, prev) => {
      if (s.cv === prev.cv && s.activeTemplate === prev.activeTemplate && s.baseline === prev.baseline) {
        return;
      }
      if (!savesReady.current) return; // don't save before the initial adopt/seed finishes
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void runSave(), 1500);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [status]);

  return null;
}
