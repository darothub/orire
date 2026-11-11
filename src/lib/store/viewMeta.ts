import type { WorkspaceView } from "./viewStore";

/** Presentation metadata for a workspace: the label, one-line hint and icon
 *  shown wherever a view is surfaced (left rail, ⌘K palette, panel headings). */
export interface ViewMeta {
  label: string;
  hint: string;
  icon: string;
}

/**
 * Single source of truth for every workspace's user-facing label, hint and
 * icon. The rail, the command palette and panel headings all read from here,
 * so renaming a feature is a one-line change in this file.
 *
 * Typed as `Record<WorkspaceView, …>`, so the compiler fails the build if a
 * view is added to the `WorkspaceView` union without metadata here.
 *
 * NOTE: labels only. Internal identifiers (the `view` keys themselves, routes,
 * analytics events, store names) live elsewhere and must stay stable.
 */
export const VIEW_META: Record<WorkspaceView, ViewMeta> = {
  spotlight: { label: "Home", hint: "Your building blocks — arrange your CV course", icon: "⌂" },
  create: { label: "Create", hint: "Build a CV from scratch, step by step — free", icon: "✚" },
  edit: { label: "Edit", hint: "Two-pane live editor", icon: "✎" },
  rebrand: { label: "Re-brand", hint: "Restructure a CV into a new template", icon: "⟳" },
  refine: { label: "Refine", hint: "Connect an assistant · import · tailor to a job", icon: "✦" },
  target: { label: "Simulate", hint: "Simulate the ideal match & edit toward it", icon: "🎯" },
  cover: { label: "Cover", hint: "Write, edit & export a cover letter", icon: "✉" },
  export: { label: "Export", hint: "Style, page layout & PDF download", icon: "⭳" },
  history: { label: "Library", hint: "Your saved CV versions, filed by company", icon: "🗂" },
  rate: { label: "Grade", hint: "Score initial → final", icon: "★" },
  plans: { label: "Plans", hint: "Pricing & what each plan unlocks", icon: "◆" },
  profile: { label: "Profile", hint: "Your activity, rating & plan", icon: "☻" },
  connect: { label: "AI Settings", hint: "Assistants", icon: "⚙" },
};

/** Views that need an account when used as a guest (AI runs, downloads). */
export const ACCOUNT_VIEWS: Partial<Record<WorkspaceView, string>> = {
  rebrand: "Sign up to re-brand a CV with AI",
  refine: "Sign up to refine your CV with AI",
  target: "Sign up to simulate a match with AI",
  cover: "Sign up to write a cover letter with AI",
  rate: "Sign up to grade your CV with AI",
  connect: "Sign up to set up AI assistants",
  export: "Sign up to export your CV",
};

/** Shorthand for the label of a view — handy for panel headings that mirror the
 *  nav word (e.g. the Simulate / Grade / Export page titles). */
export const viewLabel = (v: WorkspaceView): string => VIEW_META[v].label;
