import type { ComponentType } from "react";
import type { CVData } from "@/lib/cv/schema";
import { Aurora } from "./Aurora";
import { Noir } from "./Noir";
import { Meridian } from "./Meridian";
import { Vertex } from "./Vertex";

export interface TemplateMeta {
  id: string;
  name: string;
  blurb: string;
  /** Small gradient used on the picker card accent. */
  swatch: string;
  Component: ComponentType<{ cv: CVData }>;
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "aurora",
    name: "Aurora",
    blurb: "Editorial light · gradient spine",
    swatch: "linear-gradient(120deg,#6ee7d0,#8b7cff)",
    Component: Aurora,
  },
  {
    id: "noir",
    name: "Noir",
    blurb: "Dark luxe · oversized serif",
    swatch: "linear-gradient(120deg,#1a1a1f,#c9a24b)",
    Component: Noir,
  },
  {
    id: "meridian",
    name: "Meridian",
    blurb: "Swiss minimal · mono labels",
    swatch: "linear-gradient(120deg,#e7e9ef,#111318)",
    Component: Meridian,
  },
  {
    id: "vertex",
    name: "Vertex",
    blurb: "Bold gradient sidebar",
    swatch: "linear-gradient(160deg,#7c3aed,#ec4899)",
    Component: Vertex,
  },
];

export function getTemplate(id: string): TemplateMeta {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
