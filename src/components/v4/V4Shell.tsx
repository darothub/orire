"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/BrandMark";
import { CloudSync } from "@/components/auth/CloudSync";
import { V4_NAV, type V4NavKey } from "@/lib/v4/nav";
import { useCollapsed } from "@/lib/v4/useCollapsed";
import "./v4.css";

/**
 * The frame every v4 page shares: brand, navigation (labels on desktop, icons
 * only on mobile) and the cloud bridge that keeps the CV and the version
 * library in sync with the signed-in account.
 */
export function V4Shell({ active, label, children }: { active: V4NavKey; label: string; children: ReactNode }) {
  const [collapsed, toggleCollapsed] = useCollapsed("menu");
  return (
    <div className={`v4${collapsed ? " v4--collapsed" : ""}`}>
      <CloudSync />
      <aside className="v4-side">
        <Link href="/v4" className="v4-brand" aria-label="Orire home">
          <BrandMark size={28} />
          <span><b>Orire</b><small>v4</small></span>
        </Link>
        <nav className="v4-nav" aria-label="Orire">
          {V4_NAV.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              className={`v4-navitem${n.key === active ? " on" : ""}`}
              aria-current={n.key === active ? "page" : undefined}
              aria-label={n.label}
              title={n.label}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d={n.icon} /></svg>
              <span className="v4-navlabel">{n.label}</span>
            </Link>
          ))}
        </nav>
        <button type="button" className="v4-collapse" onClick={toggleCollapsed} aria-expanded={!collapsed} aria-label={collapsed ? "Expand menu" : "Collapse menu"} title={collapsed ? "Expand menu" : "Collapse menu"}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} /></svg>
          <span className="v4-navlabel">Collapse menu</span>
        </button>
      </aside>
      <main className="v4-main" aria-label={label}>{children}</main>
    </div>
  );
}
