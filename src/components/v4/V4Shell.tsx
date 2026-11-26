"use client";

import Link from "next/link";
import { type ReactNode, useEffect } from "react";
import { BrandMark } from "@/components/BrandMark";
import { CloudSync } from "@/components/auth/CloudSync";
import { type V4NavKey, V4_CLASSIC_HREF, V4_HOME_HREF, V4_NAV } from "@/lib/v4/nav";
import { setClassicChosen } from "@/lib/v4/classic";
import { useCollapsed } from "@/lib/v4/useCollapsed";
import "./v4.css";

/**
 * The frame every v4 page shares: brand, navigation (labels on desktop, icons
 * only on mobile) and the cloud bridge that keeps the CV and the version
 * library in sync with the signed-in account.
 */
export function V4Shell({ active, label, children }: { active: V4NavKey; label: string; children: ReactNode }) {
  const [collapsed, toggleCollapsed] = useCollapsed("menu");
  // Being here means they want v4, so a later visit to the home page sends them back here.
  useEffect(() => setClassicChosen(false), []);
  return (
    <div className={`v4${collapsed ? " v4--collapsed" : ""}`}>
      <CloudSync />
      <aside className="v4-side">
        <Link href={V4_HOME_HREF} className="v4-brand" aria-label="Orire home">
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
        <Link href={V4_CLASSIC_HREF} className="v4-classic" title="Go back to the current Orire">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M10 6l-6 6 6 6M4 12h16" /></svg>
          <span className="v4-navlabel">Classic Orire</span>
        </Link>
        <button type="button" className="v4-collapse" onClick={toggleCollapsed} aria-expanded={!collapsed} aria-label={collapsed ? "Expand menu" : "Collapse menu"} title={collapsed ? "Expand menu" : "Collapse menu"}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} /></svg>
          <span className="v4-navlabel">Collapse menu</span>
        </button>
      </aside>
      <main className="v4-main" aria-label={label}>{children}</main>
    </div>
  );
}
