"use client";

import type { ReactNode } from "react";

export interface SimNotice {
  id: string;
  body: ReactNode;
  actions?: ReactNode;
}

/** One place for every banner on the Simulate screen (usage, stale JD, re-sim prompt). */
export function NoticeSlot({ notices }: { notices: SimNotice[] }) {
  if (notices.length === 0) return null;
  return (
    <div className="sim-notices" role="status">
      {notices.map((n) => (
        <div key={n.id} className="sim-notice">
          <div className="sim-notice-body">{n.body}</div>
          {n.actions ? <div className="sim-notice-actions">{n.actions}</div> : null}
        </div>
      ))}
    </div>
  );
}
