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
import { useStorageScope } from "@/components/auth/StorageScope";
import { useTargetStore } from "@/lib/store/targetStore";

/**
 * Bridges the local CV (Zustand + localStorage) with the signed-in user's cloud
 * copy. Renders nothing.
 *  - On first authentication: adopt the server copy if one exists, otherwise
 *    push the current local CV up so it becomes the user's cloud document
 *    (only when the CV is a real started non-sample draft — never leftover
 *    memory from another account).
 *  - While signed in: debounce-save edits to the server, with a status
 *    indicator + one retry.
 *  - On sign-out: clear the local CV + history once storage is on the anon
 *    key (deferred wipe), so a different account never inherits data.
 *
 * Waits for StorageScope so adopt/migrate always run against the bucket for
 * the current user id (never a previous account's localStorage key).
 */
export function CloudSync() {
  const { data, status } = useSession();
  const sessionUserId = data?.user?.id ?? null;
  const scope = useStorageScope();
  // Storage keys must match the session before we touch cloud or wipe local.
  const scopeReady =
    scope.ready &&
    ((status === "authenticated" && !!sessionUserId && scope.userId === sessionUserId) ||
      (status === "unauthenticated" && scope.userId === null));

  const hydratedFor = useRef<string | null>(null);
  const migratedFor = useRef<string | null>(null);
  // Saves stay OFF until the initial adopt/seed has fully completed, so an edit
  // (or the hydrate itself) during the async load can't overwrite the cloud
  // copy with stale local state.
  const savesReady = useRef(false);
  const prevStatus = useRef<typeof status | null>(null);
  /** Sign-out requested; wipe runs when anon scope is ready (not same-tick race). */
  const pendingWipe = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt-or-seed once per authenticated user id (after storage is bound).
  useEffect(() => {
    if (status !== "authenticated" || !scopeReady || !sessionUserId) return;
    if (hydratedFor.current === sessionUserId) return;
    hydratedFor.current = sessionUserId;
    // Block autosave until this account's adopt/seed finishes (also on account switch).
    savesReady.current = false;
    let cancelled = false;
    (async () => {
      try {
        const remote = await loadWorkingCV();
        if (cancelled) return;
        const store = useCVStore.getState();
        if (remote) {
          store.hydrateFromCloud({ cv: remote.data, template: remote.template, baseline: remote.baseline });
        } else if (store.started && !isSampleCV(store.cv)) {
          // Seed only a real draft that survived StorageScope guest-preserve
          // into *this* empty user bucket. Sample / unstarted never become
          // cloud docs; empty buckets after account switch are reset to sample.
          await saveWorkingCV({ data: store.cv, template: store.activeTemplate, baseline: store.baseline });
          if (cancelled) return;
        }
      } catch {
        // A hiccup adopting/seeding the working CV must not wedge the session —
        // autosave still arms, and cloud mode is flipped by the effect below.
      } finally {
        if (!cancelled) savesReady.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, scopeReady, sessionUserId, scope.generation]);

  // Enter cloud mode as soon as we're authenticated — independent of the
  // adopt/seed path above — so the library's cloud features (share, server CRUD)
  // are available even if the initial working-CV load hiccups. migrateLocalToCloud
  // moves any versions saved anonymously in this browser into the account first
  // (each as its own Document row, never touching activeDocumentId — that stays
  // owned by the adopt/seed effect above), then enters cloud mode exactly as
  // refreshFromCloud alone used to. Guarded so it fires once per user id.
  // After account-scoped reset, leftover A versions are gone; only true guest
  // library rows (or empty → refreshFromCloud) remain.
  useEffect(() => {
    if (status !== "authenticated" || !scopeReady || !sessionUserId) return;
    if (migratedFor.current === sessionUserId) return;
    migratedFor.current = sessionUserId;
    void useLibraryStore.getState().migrateLocalToCloud();
  }, [status, scopeReady, sessionUserId, scope.generation]);

  // Track sign-out with a deferred wipe: when status flips authenticated →
  // unauthenticated, scope often still has the old user id for a tick, so
  // scopeReady is false and a same-tick wipe would no-op forever. Arm
  // pendingWipe and run reset once anon scope is ready. Cancel if the user
  // signs in again before wipe.
  useEffect(() => {
    const was = prevStatus.current;
    prevStatus.current = status;

    if (status === "authenticated") {
      pendingWipe.current = false;
      return;
    }

    if (status !== "unauthenticated") return;

    hydratedFor.current = null;
    migratedFor.current = null;
    savesReady.current = false;
    usePlanStore.getState().clearServer();
    useUsageStore.getState().setSummary(null);

    if (was === "authenticated") pendingWipe.current = true;

    if (pendingWipe.current && scopeReady && scope.userId === null) {
      pendingWipe.current = false;
      useCVStore.getState().reset();
      useLibraryStore.getState().clear();
      useTargetStore.getState().clearTarget();
      useSyncStore.getState().setStatus("idle");
    }
  }, [status, scopeReady, scope.generation, scope.userId]);

  // Mirror the server-truth plan + usage whenever we become authenticated, so
  // the plan UI shows the enforceable numbers (not the local trial counter).
  useEffect(() => {
    if (status !== "authenticated" || !scopeReady) return;
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
  }, [status, scopeReady, sessionUserId, scope.generation]);

  // Debounced autosave of edits while signed in, with status + a single retry.
  useEffect(() => {
    if (status !== "authenticated" || !scopeReady || !sessionUserId) return;

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
  }, [status, scopeReady, sessionUserId, scope.generation]);

  return null;
}
