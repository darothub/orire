import type { ComponentType } from "react";
import type { CVData } from "@/lib/cv/schema";
import { TEMPLATE_CATALOG, type TemplateInfo } from "@/lib/templates/catalog";
import { Aurora } from "./Aurora";
import { Noir } from "./Noir";
import { Meridian } from "./Meridian";
import { Vertex } from "./Vertex";
import { Resume, type Layout } from "./Resume";

export interface TemplateMeta extends TemplateInfo {
  Component: ComponentType<{ cv: CVData }>;
  /** True for single-column layouts — the safest for ATS that parse the visible
   *  columns. Multi-column ("Design") templates still carry Orire's logical
   *  invisible text layer, so they remain machine-readable; this flag is a
   *  user-facing recommendation, not a hard guarantee. */
  ats: boolean;
}

/**
 * Single-column (ATS-safe) templates. Everything else uses an aside/sidebar
 * (multi-column) layout and is labelled "Design". Keep in sync with the layouts
 * below — the registry test cross-checks that every catalog id is classified.
 */
const ATS_SAFE_IDS = new Set<string>([
  "noir", "meridian", // bespoke single-column
  "slate", "ivory", "onyx", "sapphire", "marigold", "crimson", "nordic", "mono", "aqua", "oxford", "sterling", "imperial",
]);

/** Whether a template is single-column / ATS-safe. */
export function isAtsSafe(id: string): boolean {
  return ATS_SAFE_IDS.has(id);
}

/** Build a themed template component from the shared Resume engine. */
function themed(root: string, layout: Layout): ComponentType<{ cv: CVData }> {
  const C = ({ cv }: { cv: CVData }) => <Resume cv={cv} root={root} layout={layout} />;
  C.displayName = `Themed(${root})`;
  return C;
}

/**
 * id -> React component. Display metadata (name/blurb/swatch) lives in the
 * data-only catalog; this map only wires each id to how it renders.
 */
const COMPONENTS: Record<string, ComponentType<{ cv: CVData }>> = {
  aurora: Aurora,
  noir: Noir,
  meridian: Meridian,
  vertex: Vertex,
  slate: themed("t-slate", "single"),
  ivory: themed("t-ivory", "single"),
  carbon: themed("t-carbon", "aside-right"),
  coral: themed("t-coral", "aside-left"),
  onyx: themed("t-onyx", "single"),
  verde: themed("t-verde", "aside-right"),
  sapphire: themed("t-sapphire", "single"),
  marigold: themed("t-marigold", "single"),
  frost: themed("t-frost", "aside-left"),
  crimson: themed("t-crimson", "single"),
  nordic: themed("t-nordic", "single"),
  mono: themed("t-mono", "single"),
  plum: themed("t-plum", "aside-right"),
  sand: themed("t-sand", "aside-left"),
  aqua: themed("t-aqua", "single"),
  graphite: themed("t-graphite", "aside-right"),
  oxford: themed("t-oxford", "single"),
  bordeaux: themed("t-bordeaux", "aside-right"),
  sterling: themed("t-sterling", "single"),
  imperial: themed("t-imperial", "single"),
  consul: themed("t-consul", "aside-left"),
};

export const TEMPLATES: TemplateMeta[] = TEMPLATE_CATALOG.map((info) => ({
  ...info,
  Component: COMPONENTS[info.id] ?? Aurora,
  ats: isAtsSafe(info.id),
}));

export function getTemplate(id: string): TemplateMeta {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
