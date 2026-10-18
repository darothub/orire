/**
 * Bind sensitive Zustand persist stores to the current account (or anonymous).
 * Called from the client StorageScope component whenever the session user id
 * settles.
 *
 * Critical: Zustand persist rehydrate() on an *empty* key leaves prior
 * in-memory state untouched. We always reset empty buckets after rebind so
 * Account B cannot inherit Account A's CV / flow from memory.
 *
 * Guest → first account may keep a true guest draft in *local* state only.
 * After any authenticated session in this tab, guest-preserve is disabled so
 * a later signup cannot pick up the previous account's leftover draft.
 * CloudSync must not auto-seed cloud from local (see CloudSync.tsx).
 */

"use client";

import { useCVStore } from "@/lib/store/cvStore";
import { useLibraryStore } from "@/lib/store/libraryStore";
import { usePlanStore } from "@/lib/store/planStore";
import { useTargetStore } from "@/lib/store/targetStore";
import { useFlowStore } from "@/lib/store/flowStore";
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
/**
 * Once any real account has been bound in this tab, do not carry guest/local
 * drafts into the next empty account (stops A → sign-out → B inheritance).
 */
let sawAuthenticatedAccount = false;

/** Test-only: reset module bind state between cases. */
export function __resetStorageScopeForTests(): void {
  state = { ready: false, userId: null, generation: 0 };
  bindQueue = Promise.resolve();
  lastBound = undefined;
  sawAuthenticatedAccount = false;
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

/** Default empty workspace (sample CV, no library/target, recommended flow). */
function resetSensitiveStores(): void {
  useCVStore.getState().reset();
  useLibraryStore.getState().clear();
  useTargetStore.getState().clearTarget();
  usePlanStore.getState().clearServer();
  useFlowStore.getState().resetFlow();
}

/**
 * Rebind cv / library / target / plan / flow persist keys to `userId`.
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

  const prevId = lastBound;
  const fromGuest = (prevId === null || prevId === undefined) && !!userId;
  const leavingAccount = !!prevId && !userId;
  const switchingAccounts = !!prevId && !!userId && prevId !== userId;
  // Carry a guest draft only for the first account ever in this tab — never
  // after a prior sign-in (that draft is usually the previous user's work).
  const allowGuestPreserve = fromGuest && !sawAuthenticatedAccount;

  const cvSnap = useCVStore.getState();
  const libSnap = useLibraryStore.getState();
  const targetSnap = useTargetStore.getState();
  const flowSnap = useFlowStore.getState();

  const keepCv =
    allowGuestPreserve && cvSnap.started && !isSampleCV(cvSnap.cv)
      ? {
          cv: cvSnap.cv,
          activeTemplate: cvSnap.activeTemplate,
          baseline: cvSnap.baseline,
          started: cvSnap.started,
          ignoredSkills: cvSnap.ignoredSkills,
        }
      : null;
  const keepLib =
    allowGuestPreserve && !libSnap.cloud && libSnap.versions.length > 0
      ? { versions: libSnap.versions, activeId: libSnap.activeId, lastCompany: libSnap.lastCompany }
      : null;
  const keepTarget =
    allowGuestPreserve && targetSnap.ideal
      ? {
          ideal: targetSnap.ideal,
          jd: targetSnap.jd,
          label: targetSnap.label,
          createdAt: targetSnap.createdAt,
          baseScore: targetSnap.baseScore,
        }
      : null;
  const keepFlow =
    allowGuestPreserve
      ? { sequence: flowSnap.sequence, coachSeen: flowSnap.coachSeen }
      : null;

  const cvName = scopedNameFor("cv", userId);
  const libName = scopedNameFor("library", userId);
  const targetName = scopedNameFor("target", userId);
  const planName = scopedNameFor("plan", userId);
  const flowName = scopedNameFor("flow", userId);

  const hadUserCv = !!(storage && storageHasPayload(storage, cvName));
  const hadUserLib = !!(storage && storageHasPayload(storage, libName));
  const hadUserTarget = !!(storage && storageHasPayload(storage, targetName));
  const hadUserFlow = !!(storage && storageHasPayload(storage, flowName));

  await rebindPersistName(useCVStore, cvName);
  await rebindPersistName(useLibraryStore, libName);
  await rebindPersistName(useTargetStore, targetName);
  await rebindPersistName(usePlanStore, planName);
  await rebindPersistName(useFlowStore, flowName);

  if (leavingAccount) {
    resetSensitiveStores();
  } else if (switchingAccounts || fromGuest || lastBound === undefined) {
    if (!hadUserCv) {
      if (keepCv) useCVStore.setState(keepCv);
      else useCVStore.getState().reset();
    }
    if (!hadUserLib) {
      if (keepLib) {
        useLibraryStore.setState({
          versions: keepLib.versions,
          activeId: keepLib.activeId,
          lastCompany: keepLib.lastCompany,
          cloud: false,
        });
      } else {
        useLibraryStore.getState().clear();
      }
    }
    if (!hadUserTarget) {
      if (keepTarget) useTargetStore.setState(keepTarget);
      else useTargetStore.getState().clearTarget();
    }
    if (!hadUserFlow) {
      if (keepFlow) useFlowStore.setState(keepFlow);
      else useFlowStore.getState().resetFlow();
    }
    if (!userId || switchingAccounts || fromGuest) {
      usePlanStore.getState().clearServer();
    }
  }

  if (userId) sawAuthenticatedAccount = true;

  lastBound = userId;
  emit({
    ready: true,
    userId,
    generation: state.generation + 1,
  });
}
