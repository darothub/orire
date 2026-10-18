/**
 * Bind sensitive Zustand persist stores to the current account (or anonymous).
 * Called from the client StorageScope component whenever the session user id
 * settles. Preserves in-flight anonymous CV / library work across sign-in so
 * CloudSync can still seed the new account from what the user just built.
 */

"use client";

import { useCVStore } from "@/lib/store/cvStore";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { usePlanStore } from "@/lib/store/planStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { isSampleCV } from "@/lib/cv/sample";
import {
  migrateAllLegacyKeys,
  rebindPersistName,
  scopedNameFor,
  storageHasPayload,
  type StorageAccountId,
} from "@/lib/store/storageScope";

export interface StorageScopeState {
  /** True after the first successful bind for the current session status. */
  ready: boolean;
  /** The account id the stores are currently bound to (`null` = anonymous). */
  userId: StorageAccountId;
  /** Monotonic counter so dependents can re-run when the scope flips. */
  generation: number;
}

type Listener = (s: StorageScopeState) => void;

let state: StorageScopeState = { ready: false, userId: null, generation: 0 };
const listeners = new Set<Listener>();
let bindQueue: Promise<void> = Promise.resolve();
let lastBound: StorageAccountId | undefined = undefined;

/** Test-only: reset module bind state between cases. */
export function __resetStorageScopeForTests(): void {
  state = { ready: false, userId: null, generation: 0 };
  bindQueue = Promise.resolve();
  lastBound = undefined;
}

function emit(next: StorageScopeState) {
  state = next;
  for (const l of listeners) l(state);
}

export function getStorageScopeState(): StorageScopeState {
  return state;
}

export function subscribeStorageScope(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Rebind cv / library / target / plan persist keys to `userId`.
 * Serialised: overlapping session transitions wait their turn.
 */
export function applyStorageScope(userId: StorageAccountId): Promise<void> {
  bindQueue = bindQueue.then(() => runBind(userId)).catch(() => {
    // Never leave the queue broken after a bind failure.
  });
  return bindQueue;
}

async function runBind(userId: StorageAccountId): Promise<void> {
  const storage = browserStorage();
  if (storage) migrateAllLegacyKeys(storage);

  // Same account already bound — just mark ready.
  if (lastBound === userId && state.ready) {
    emit({ ...state, ready: true });
    return;
  }

  // Snapshot anonymous working state BEFORE rehydrate can replace memory.
  // Used when signing in so a brand-new account key does not drop the CV the
  // user just edited as a guest.
  const prevId = lastBound;
  const signingIn = (prevId === null || prevId === undefined) && !!userId;
  const cvSnap = useCVStore.getState();
  const libSnap = useLibraryStore.getState();
  const targetSnap = useTargetStore.getState();
  const keepCv =
    signingIn && cvSnap.started && !isSampleCV(cvSnap.cv)
      ? {
          cv: cvSnap.cv,
          activeTemplate: cvSnap.activeTemplate,
          baseline: cvSnap.baseline,
          started: cvSnap.started,
          ignoredSkills: cvSnap.ignoredSkills,
        }
      : null;
  const keepLib =
    signingIn && !libSnap.cloud && libSnap.versions.length > 0
      ? { versions: libSnap.versions, activeId: libSnap.activeId, lastCompany: libSnap.lastCompany }
      : null;
  const keepTarget =
    signingIn && targetSnap.ideal
      ? {
          ideal: targetSnap.ideal,
          jd: targetSnap.jd,
          label: targetSnap.label,
          createdAt: targetSnap.createdAt,
          baseScore: targetSnap.baseScore,
        }
      : null;

  const cvName = scopedNameFor("cv", userId);
  const libName = scopedNameFor("library", userId);
  const targetName = scopedNameFor("target", userId);
  const planName = scopedNameFor("plan", userId);

  const hadUserCv = !!(storage && userId && storageHasPayload(storage, cvName));
  const hadUserLib = !!(storage && userId && storageHasPayload(storage, libName));
  const hadUserTarget = !!(storage && userId && storageHasPayload(storage, targetName));

  await rebindPersistName(useCVStore, cvName);
  await rebindPersistName(useLibraryStore, libName);
  await rebindPersistName(useTargetStore, targetName);
  await rebindPersistName(usePlanStore, planName);

  // Restore guest work into an empty user bucket so CloudSync can seed cloud.
  if (keepCv && !hadUserCv) {
    const now = useCVStore.getState();
    if (!now.started || isSampleCV(now.cv)) {
      useCVStore.setState(keepCv);
    }
  }
  if (keepLib && !hadUserLib) {
    const now = useLibraryStore.getState();
    if (!now.cloud && now.versions.length === 0) {
      useLibraryStore.setState({
        versions: keepLib.versions,
        activeId: keepLib.activeId,
        lastCompany: keepLib.lastCompany,
        cloud: false,
      });
    }
  }
  if (keepTarget && !hadUserTarget) {
    const now = useTargetStore.getState();
    if (!now.ideal) {
      useTargetStore.setState(keepTarget);
    }
  }

  // Signing out: callers (CloudSync) still reset CV/library; ensure plan drops
  // any server mirror that might have been rehydrated from a stale write.
  if (!userId) {
    usePlanStore.getState().clearServer();
  }

  lastBound = userId;
  emit({
    ready: true,
    userId,
    generation: state.generation + 1,
  });
}
