import type { ComponentType } from "react";
import type { CVData } from "@/lib/cv/schema";
import { Aurora } from "./Aurora";
import { Noir } from "./Noir";
import { Meridian } from "./Meridian";
import { Vertex } from "./Vertex";
import { Resume, type Layout } from "./Resume";

export interface TemplateMeta {
  id: string;
  name: string;
  blurb: string;
  /** Small gradient used on the picker card accent. */
  swatch: string;
  Component: ComponentType<{ cv: CVData }>;
}

/** Build a themed template component from the shared Resume engine. */
function themed(root: string, layout: Layout): ComponentType<{ cv: CVData }> {
  const C = ({ cv }: { cv: CVData }) => <Resume cv={cv} root={root} layout={layout} />;
  C.displayName = `Themed(${root})`;
  return C;
}

export const TEMPLATES: TemplateMeta[] = [
  // Bespoke
  { id: "aurora", name: "Aurora", blurb: "Editorial light · gradient spine", swatch: "linear-gradient(120deg,#6ee7d0,#8b7cff)", Component: Aurora },
  { id: "noir", name: "Noir", blurb: "Dark luxe · oversized serif", swatch: "linear-gradient(120deg,#1a1a1f,#c9a24b)", Component: Noir },
  { id: "meridian", name: "Meridian", blurb: "Swiss minimal · mono labels", swatch: "linear-gradient(120deg,#e7e9ef,#111318)", Component: Meridian },
  { id: "vertex", name: "Vertex", blurb: "Bold gradient sidebar", swatch: "linear-gradient(160deg,#7c3aed,#ec4899)", Component: Vertex },

  // Themed (Resume engine)
  { id: "slate", name: "Slate", blurb: "Corporate blue · accent rail", swatch: "linear-gradient(120deg,#2563eb,#1e40af)", Component: themed("t-slate", "single") },
  { id: "ivory", name: "Ivory", blurb: "Warm cream · centered serif", swatch: "linear-gradient(120deg,#fbf7ef,#a8743a)", Component: themed("t-ivory", "single") },
  { id: "carbon", name: "Carbon", blurb: "Dark tech · cyan mono", swatch: "linear-gradient(120deg,#0d1117,#22d3ee)", Component: themed("t-carbon", "aside-right") },
  { id: "coral", name: "Coral", blurb: "Soft peach · friendly", swatch: "linear-gradient(120deg,#ffe6de,#ef5d7a)", Component: themed("t-coral", "aside-left") },
  { id: "onyx", name: "Onyx", blurb: "Near-black · uppercase", swatch: "linear-gradient(120deg,#111318,#5b6472)", Component: themed("t-onyx", "single") },
  { id: "verde", name: "Verde", blurb: "Deep green · gold serif", swatch: "linear-gradient(120deg,#1f6b46,#b08a2e)", Component: themed("t-verde", "aside-right") },
  { id: "sapphire", name: "Sapphire", blurb: "Royal blue · banner header", swatch: "linear-gradient(120deg,#1d4ed8,#4f46e5)", Component: themed("t-sapphire", "single") },
  { id: "marigold", name: "Marigold", blurb: "Amber editorial · big serif", swatch: "linear-gradient(120deg,#fffdf7,#d98a00)", Component: themed("t-marigold", "single") },
  { id: "frost", name: "Frost", blurb: "Icy blue-gray · calm", swatch: "linear-gradient(120deg,#f7fafc,#3b82a6)", Component: themed("t-frost", "aside-left") },
  { id: "crimson", name: "Crimson", blurb: "Bold red · condensed caps", swatch: "linear-gradient(120deg,#dc2626,#7f1d1d)", Component: themed("t-crimson", "single") },
  { id: "nordic", name: "Nordic", blurb: "Muted · airy whitespace", swatch: "linear-gradient(120deg,#fbfbfa,#6b7d76)", Component: themed("t-nordic", "single") },
  { id: "mono", name: "Mono", blurb: "Monochrome typewriter", swatch: "linear-gradient(120deg,#ffffff,#111111)", Component: themed("t-mono", "single") },
  { id: "plum", name: "Plum", blurb: "Purple · modern sidebar", swatch: "linear-gradient(120deg,#9333ea,#c026d3)", Component: themed("t-plum", "aside-right") },
  { id: "sand", name: "Sand", blurb: "Desert neutral · warm", swatch: "linear-gradient(120deg,#faf7f2,#9a7b4f)", Component: themed("t-sand", "aside-left") },
  { id: "aqua", name: "Aqua", blurb: "Teal · rounded chips", swatch: "linear-gradient(120deg,#0d9488,#14b8a6)", Component: themed("t-aqua", "single") },
  { id: "graphite", name: "Graphite", blurb: "Grayscale · orange accent", swatch: "linear-gradient(120deg,#1b1d21,#ea580c)", Component: themed("t-graphite", "aside-right") },

  // Executive line
  { id: "oxford", name: "Oxford", blurb: "Navy + bronze · double-rule crest", swatch: "linear-gradient(120deg,#16233b,#a9803f)", Component: themed("t-oxford", "single") },
  { id: "bordeaux", name: "Bordeaux", blurb: "Oxblood wine · classic serif", swatch: "linear-gradient(120deg,#7a2230,#2a1b1e)", Component: themed("t-bordeaux", "aside-right") },
  { id: "sterling", name: "Sterling", blurb: "Charcoal + steel · tracked caps", swatch: "linear-gradient(120deg,#22262c,#51607a)", Component: themed("t-sterling", "single") },
  { id: "imperial", name: "Imperial", blurb: "Black + champagne gold banner", swatch: "linear-gradient(120deg,#0b0c10,#b08d4c)", Component: themed("t-imperial", "single") },
  { id: "consul", name: "Consul", blurb: "Graphite + deep teal · serif", swatch: "linear-gradient(120deg,#1c2126,#0f6b6b)", Component: themed("t-consul", "aside-left") },
];

export function getTemplate(id: string): TemplateMeta {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
