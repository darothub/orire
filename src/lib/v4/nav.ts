/** The v4 navigation, declared once and used by the shell on every v4 page. */
export type V4NavKey = "home" | "copilot" | "studio" | "library" | "export";

export interface V4NavItem {
  key: V4NavKey;
  href: string;
  label: string;
  /** SVG path data (24x24 viewBox, stroked). */
  icon: string;
}

export const V4_NAV: readonly V4NavItem[] = [
  { key: "home", href: "/v4", label: "Home", icon: "M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" },
  { key: "copilot", href: "/occ/v4", label: "Copilot", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
  { key: "studio", href: "/v4/studio", label: "CV Studio", icon: "M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2zM8 8h8M8 12h8M8 16h5" },
  { key: "library", href: "/v4/library", label: "Version library", icon: "M4 6h16M4 12h16M4 18h10" },
  { key: "export", href: "/v4/export", label: "Export", icon: "M12 3v12M7 8l5-5 5 5M5 21h14" },
];
