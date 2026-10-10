"use client";

import { useSyncStore, type SyncStatus as Status } from "@/lib/store/syncStore";

const LABEL: Record<Exclude<Status, "idle">, string> = {
  saving: "Saving…",
  saved: "Saved",
  error: "Couldn’t save",
};

/**
 * Small live indicator for cloud autosave. Renders nothing when idle (e.g.
 * signed out or before the first save) and announces changes politely.
 */
export function SyncStatus() {
  const status = useSyncStore((s) => s.status);
  if (status === "idle") return null;
  return (
    <span className={`sync-status sync-${status}`} role="status" aria-live="polite" title={status === "error" ? "Your last change could not be saved to the cloud." : undefined}>
      <span className="sync-dot" aria-hidden />
      {LABEL[status]}
    </span>
  );
}
