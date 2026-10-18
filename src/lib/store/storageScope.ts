/**
 * orire — account-scoped localStorage keys for persisted Zustand stores.
 *
 * Critique finding: a single browser-wide key (e.g. `orire-cv-v1`) let Account B
 * inherit Account A's CV on a shared machine. Each sensitive store now uses a
 * key that includes either `anon` or the signed-in user id. Preferences that are
 * intentionally device-wide (theme, settings, style) stay global.
 *
 * This module is pure/DOM-light so it can be unit-tested without jsdom beyond
 * a simple localStorage stub.
 */

export type StorageAccountId = string | null;

/** Stores that hold user-owned / private data and must not cross accounts. */
export const SCOPED_STORES = {
  cv: { base: "orire-cv", legacy: "orire-cv-v1" },
  library: { base: "orire-library", legacy: "orire-library-v1" },
  target: { base: "orire-target", legacy: "orire-target-v1" },
  plan: { base: "orire-plan", legacy: "orire-plan-v1" },
} as const;

export type ScopedStoreId = keyof typeof SCOPED_STORES;

/**
 * Build the localStorage name for a scoped store.
 * - signed out → `orire-cv:anon:v1`
 * - signed in  → `orire-cv:u:<userId>:v1`
 */
export function scopedStorageName(base: string, userId: StorageAccountId): string {
  if (userId && userId.trim()) {
    // Encode so odd characters in ids cannot break key parsing or collide.
    return `${base}:u:${encodeURIComponent(userId.trim())}:v1`;
  }
  return `${base}:anon:v1`;
}

export function scopedNameFor(store: ScopedStoreId, userId: StorageAccountId): string {
  return scopedStorageName(SCOPED_STORES[store].base, userId);
}

/** True when `localStorage` has a non-empty value for `key`. */
export function storageHasPayload(storage: Storage, key: string): boolean {
  try {
    const raw = storage.getItem(key);
    if (raw == null || raw === "") return false;
    // Zustand persist wraps state as JSON; empty object still "has" a payload.
    return true;
  } catch {
    return false;
  }
}

/**
 * One-time move of a legacy unscoped key into the anonymous scoped key.
 * Never overwrites an existing scoped payload. Removes the legacy key after a
 * successful copy so later accounts cannot re-claim it.
 */
export function migrateLegacyKey(
  storage: Storage,
  legacyKey: string,
  anonKey: string,
): "moved" | "skipped" | "absent" {
  if (!storageHasPayload(storage, legacyKey)) return "absent";
  if (storageHasPayload(storage, anonKey)) {
    // Scoped anon already owns data — drop the ambiguous legacy blob.
    try {
      storage.removeItem(legacyKey);
    } catch {
      /* ignore quota / private mode */
    }
    return "skipped";
  }
  try {
    const raw = storage.getItem(legacyKey);
    if (raw == null) return "absent";
    storage.setItem(anonKey, raw);
    storage.removeItem(legacyKey);
    return "moved";
  } catch {
    return "skipped";
  }
}

/** Run legacy → anon migrations for every scoped store. Idempotent. */
export function migrateAllLegacyKeys(storage: Storage): void {
  for (const spec of Object.values(SCOPED_STORES)) {
    migrateLegacyKey(storage, spec.legacy, scopedStorageName(spec.base, null));
  }
}

/**
 * Minimal shape we need from a Zustand persist store to rebind its key.
 * Kept structural so tests can pass fakes without importing every store.
 */
export interface RebindablePersistStore {
  persist: {
    getOptions: () => { name?: string };
    setOptions: (options: { name?: string }) => void;
    rehydrate: () => void | Promise<void>;
  };
}

/**
 * Point a persist store at `nextName` and reload from storage.
 * No-ops when the name is already bound (avoids wiping in-memory state).
 */
export async function rebindPersistName(
  store: RebindablePersistStore,
  nextName: string,
): Promise<{ rebound: boolean }> {
  const current = store.persist.getOptions().name;
  if (current === nextName) return { rebound: false };
  store.persist.setOptions({ name: nextName });
  await Promise.resolve(store.persist.rehydrate());
  return { rebound: true };
}
