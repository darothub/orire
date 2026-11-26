"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { V4_STUDIO_TABS, studioTabFor } from "@/lib/v4/nav";
import { useCollapsed } from "@/lib/v4/useCollapsed";
import { V4FrameHead } from "./V4FrameHead";
import { V4Shell } from "./V4Shell";

function Icon({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d={d} /></svg>;
}

/**
 * The CV Studio's frame: title, the Copilot switch, and the tools sub-navigation
 * (Edit, Simulate, Refine). It lives in the studio layout, so switching tool
 * keeps the frame in place and only the page beside it changes.
 */
export function V4StudioFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = studioTabFor(pathname);
  const [collapsed, toggleCollapsed] = useCollapsed("studio-tools");
  return (
    <V4Shell active="studio" label="CV Studio">
      <div className="v4-frame">
        <V4FrameHead subtitle={current.blurb} copilotOn={false} />
        <div className={`v4-frame-body${collapsed ? " v4-frame-body--collapsed" : ""}`}>
          <nav className="v4-subnav" aria-label="Studio tools">
            {V4_STUDIO_TABS.map((t) => (
              <Link key={t.key} href={t.href} className={`v4-subitem${t.key === current.key ? " on" : ""}`} aria-current={t.key === current.key ? "page" : undefined} aria-label={t.label} title={t.label}>
                <Icon d={t.icon} />
                <span className="v4-sublabel">{t.label}</span>
              </Link>
            ))}
            <button type="button" className="v4-subcollapse" onClick={toggleCollapsed} aria-expanded={!collapsed} aria-label={collapsed ? "Expand tools" : "Collapse tools"} title={collapsed ? "Expand tools" : "Collapse tools"}>
              <Icon d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
              <span className="v4-sublabel">Collapse</span>
            </button>
          </nav>
          <div className="v4-frame-content">{children}</div>
        </div>
      </div>
    </V4Shell>
  );
}
