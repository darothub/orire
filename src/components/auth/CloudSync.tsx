"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useCVStore } from "@/lib/store/cvStore";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { usePlanStore } from "@/lib/store/planStore";
import { useUsageStore } from "@/lib/store/usageStore";
import { useSyncStore } from "@/lib/store/syncStore";
import { useFlowStore } from "@/lib/store/flowStore";
import { loadWorkingCV, saveWorkingCV } from "@/app/actions/cv";
import { readEntitlement } from "@/app/actions/refine";
import { useStorageScope } from "@/components/auth/StorageScope";
import { useTargetStore } from "@/lib/store/targetStore";

/**
 * Bridges the local CV (Zustand + localStorage) with the signed-in user's cloud
 * copy. Renders nothing.
 *  - On first authentication: adopt the server copy if one exists.
 *    Never auto-create a cloud document from whatever happens to be in local
 *    memory — that is how Account B inherited Account A's CV on shared
 *    browsers. First real edit while signed in still autosaves.
 *  - While signed in: debounce-save edits to the server, with a status
 *    indicator + one retry.
 *  - On sign-out: clear local CV / history / flow once storage is on the anon
 *    key (deferred wipe).
 *
 * Waits for StorageScope so adopt/migrate always run against the bucket for
 * the current user id (never a previous account's localStorage key).
 */
export function CloudSync() {
  const { data, status } = useSession();
  const sessionUserId = data?.user?.id ?? null;
  const scope = useStorageScope();
  const scopeReady =
    scope.ready &&
    ((status === "authenticated" && !!sessionUserId && scope.userId === sessionUserId) ||
      (status === "unauthenticated" && scope.userId === null));

  const hydratedFor = useRef<string | null>(null);
  const migratedFor = useRef<string | null>(null);
  const savesReady = useRef(false);
  const prevStatus = useRef<typeof status | null>(null);
  const pendingWipe = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt cloud working CV once per user id (after storage is bound).
  // No local→cloud seed on empty accounts.
  useEffect(() => {
    if (status !== "authenticated" || !scopeReady || !sessionUserId) return;
    if (hydratedFor.current === sessionUserId) return;
    hydratedFor.current = sessionUserId;
    savesReady.current = false;
    let cancelled = false;
    (async () => {
      try {
        const remote = await loadWorkingCV();
        if (cancelled) return;
        if (remote) {
          useCVStore.getState().hydrateFromCloud({
            cv: remote.data,
            template: remote.template,
            baseline: remote.baseline,
          });
        }
        // Empty cloud: leave whatever StorageScope put in the bucket (sample
        // after account switch, or a true first-time guest draft). Autosave
        // creates the first Document on the next real edit.
      } catch {
        // Adopt hiccup must not wedge the session — autosave still arms.
      } finally {
        if (!cancelled) savesReady.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, scopeReady, sessionUserId, scope.generation]);

  // Library: migrate only leftover *local* versions (guest first-run), else
  // refresh from cloud. After StorageScope wipe/reset, versions are empty so
  // this is a pure refresh for account B.
  useEffect(() => {
    if (status !== "authenticated" || !scopeReady || !sessionUserId) return;
    if (migratedFor.current === sessionUserId) return;
    migratedFor.current = sessionUserId;
    void useLibraryStore.getState().migrateLocalToCloud();
  }, [status, scopeReady, sessionUserId, scope.generation]);

  // Deferred sign-out wipe (scope often lags status by a tick).
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
      useFlowStore.getState().resetFlow();
      useSyncStore.getState().setStatus("idle");
    }
  }, [status, scopeReady, scope.generation, scope.userId]);

  useEffect(() => {
    if (status !== "authenticated" || !scopeReady) return;
    let cancelled = false;
    (async () => {
      const ent = await readEntitlement();
      if (cancelled || !ent) return;
      usePlanStore.getState().syncFromServer({ plan: ent.plan, usedThisMonth: ent.usedThisMonth });
      void useUsageStore.getState().refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [status, scopeReady, sessionUserId, scope.generation]);

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
        await new Promise((r) => setTimeout(r, 1200));
        res = await saveWorkingCV(snapshot());
      }
      useSyncStore.getState().setStatus(res.ok ? "saved" : "error");
    };

    const unsub = useCVStore.subscribe((s, prev) => {
      if (s.cv === prev.cv && s.activeTemplate === prev.activeTemplate && s.baseline === prev.baseline) {
        return;
      }
      if (!savesReady.current) return;
      // Never autosave the untouched demo persona into a new account.
      if (!s.started) return;
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
