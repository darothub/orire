"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  applyStorageScope,
  getStorageScopeState,
  subscribeStorageScope,
  type StorageScopeState,
} from "@/lib/store/applyStorageScope";

/**
 * Keeps sensitive localStorage-backed stores (CV, library, target, plan) on a
 * key that matches the current account. Renders nothing.
 *
 * Must mount under SessionProvider and before CloudSync so adopt/seed/migrate
 * run against the correct bucket.
 */
export function StorageScope() {
  const { data, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    const userId = status === "authenticated" ? (data?.user?.id ?? null) : null;
    // No id on an "authenticated" session is treated as anonymous binding; the
    // next session update with a real id will rebind.
    void applyStorageScope(userId);
  }, [status, data?.user?.id]);

  return null;
}

/** Subscribe to storage-scope readiness (for CloudSync and tests). */
export function useStorageScope(): StorageScopeState {
  const [snap, setSnap] = useState(getStorageScopeState);
  useEffect(() => subscribeStorageScope(setSnap), []);
  return snap;
}
