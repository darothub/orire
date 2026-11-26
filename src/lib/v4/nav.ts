/**
 * Where v4 lives. Every v4 link is built from these, so the path is declared once.
 * (It was /v4 while v4 was a preview; /v4 redirects here.)
 */
export const V4_BASE = "/app";
export const V4_HOME_HREF = V4_BASE;
export const V4_COPILOT_HREF = `${V4_BASE}/copilot`;
export const V4_STUDIO_HREF = `${V4_BASE}/studio`;
export const V4_SIMULATE_HREF = `${V4_STUDIO_HREF}/simulate`;
export const V4_REFINE_HREF = `${V4_STUDIO_HREF}/refine`;
export const V4_INTERVIEW_HREF = `${V4_STUDIO_HREF}/interview`;
export const V4_LIBRARY_HREF = `${V4_BASE}/library`;
export const V4_EXPORT_HREF = `${V4_BASE}/export`;

/** The v4 navigation, declared once and used by the shell on every v4 page. */
export type V4NavKey = "home" | "studio" | "copilot" | "library" | "export";

export interface V4NavItem {
  key: V4NavKey;
  href: string;
  label: string;
  /** SVG path data (24x24 viewBox, stroked). */
  icon: string;
}

export const V4_NAV: readonly V4NavItem[] = [
  { key: "home", href: V4_HOME_HREF, label: "Home", icon: "M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" },
  { key: "studio", href: V4_STUDIO_HREF, label: "CV Studio", icon: "M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2zM8 8h8M8 12h8M8 16h5" },
  { key: "copilot", href: V4_COPILOT_HREF, label: "Copilot", icon: "M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4zM19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" },
  { key: "library", href: V4_LIBRARY_HREF, label: "Version library", icon: "M4 6h16M4 12h16M4 18h10" },
  { key: "export", href: V4_EXPORT_HREF, label: "Export", icon: "M12 3v12M7 8l5-5 5 5M5 21h14" },
];

export type V4StudioKey = "edit" | "simulate" | "refine" | "interview";

export interface V4StudioTab {
  key: V4StudioKey;
  href: string;
  label: string;
  /** One line shown under the page title. */
  blurb: string;
  icon: string;
}

/** The CV Studio's own tools, in the order the sub-navigation lists them. */
export const V4_STUDIO_TABS: readonly V4StudioTab[] = [
  { key: "edit", href: V4_STUDIO_HREF, label: "Edit", blurb: "Edit, simulate and refine your CV in one place.", icon: "M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" },
  { key: "simulate", href: V4_SIMULATE_HREF, label: "Simulate", blurb: "Compare your CV with an ideal candidate for the role.", icon: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 3v3M12 18v3M3 12h3M18 12h3" },
  { key: "refine", href: V4_REFINE_HREF, label: "Refine", blurb: "Tailor the whole CV to one job description.", icon: "M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4zM19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" },
  { key: "interview", href: V4_INTERVIEW_HREF, label: "Interview", blurb: "Practise answers for the role and get feedback.", icon: "M9 3h6v11H9zM5 11a7 7 0 0014 0M12 18v3" },
];

/** The studio tab a pathname belongs to (Edit for the studio page itself). */
export function studioTabFor(pathname: string): V4StudioTab {
  return V4_STUDIO_TABS.find((t) => t.key !== "edit" && pathname.startsWith(t.href)) ?? V4_STUDIO_TABS[0];
}
