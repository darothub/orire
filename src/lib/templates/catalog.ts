/**
 * Single source of truth for template display metadata (id, name, blurb,
 * swatch). The interactive registry (src/components/templates/registry.tsx)
 * zips these with their React components, and the marketing pages
 * (/templates) read this data-only module directly — so template names and
 * blurbs live in exactly one place and can't drift between the app and the
 * public gallery.
 */

export interface TemplateInfo {
  id: string;
  name: string;
  /** Short style descriptor shown on cards. */
  blurb: string;
  /** Gradient used for the card accent / gallery visual. */
  swatch: string;
}

export const TEMPLATE_CATALOG: TemplateInfo[] = [
  // Bespoke
  { id: "aurora", name: "Aurora", blurb: "Editorial light · gradient spine", swatch: "linear-gradient(120deg,#6ee7d0,#8b7cff)" },
  { id: "noir", name: "Noir", blurb: "Dark luxe · oversized serif", swatch: "linear-gradient(120deg,#1a1a1f,#c9a24b)" },
  { id: "meridian", name: "Meridian", blurb: "Swiss minimal · mono labels", swatch: "linear-gradient(120deg,#e7e9ef,#111318)" },
  { id: "vertex", name: "Vertex", blurb: "Bold gradient sidebar", swatch: "linear-gradient(160deg,#7c3aed,#ec4899)" },

  // Themed (Resume engine)
  { id: "slate", name: "Slate", blurb: "Corporate blue · accent rail", swatch: "linear-gradient(120deg,#2563eb,#1e40af)" },
  { id: "ivory", name: "Ivory", blurb: "Warm cream · centered serif", swatch: "linear-gradient(120deg,#fbf7ef,#a8743a)" },
  { id: "carbon", name: "Carbon", blurb: "Dark tech · cyan mono", swatch: "linear-gradient(120deg,#0d1117,#22d3ee)" },
  { id: "coral", name: "Coral", blurb: "Soft peach · friendly", swatch: "linear-gradient(120deg,#ffe6de,#ef5d7a)" },
  { id: "onyx", name: "Onyx", blurb: "Near-black · uppercase", swatch: "linear-gradient(120deg,#111318,#5b6472)" },
  { id: "verde", name: "Verde", blurb: "Deep green · gold serif", swatch: "linear-gradient(120deg,#1f6b46,#b08a2e)" },
  { id: "sapphire", name: "Sapphire", blurb: "Royal blue · banner header", swatch: "linear-gradient(120deg,#1d4ed8,#4f46e5)" },
  { id: "marigold", name: "Marigold", blurb: "Amber editorial · big serif", swatch: "linear-gradient(120deg,#fffdf7,#d98a00)" },
  { id: "frost", name: "Frost", blurb: "Icy blue-gray · calm", swatch: "linear-gradient(120deg,#f7fafc,#3b82a6)" },
  { id: "crimson", name: "Crimson", blurb: "Bold red · condensed caps", swatch: "linear-gradient(120deg,#dc2626,#7f1d1d)" },
  { id: "nordic", name: "Nordic", blurb: "Muted · airy whitespace", swatch: "linear-gradient(120deg,#fbfbfa,#6b7d76)" },
  { id: "mono", name: "Mono", blurb: "Monochrome typewriter", swatch: "linear-gradient(120deg,#ffffff,#111111)" },
  { id: "plum", name: "Plum", blurb: "Purple · modern sidebar", swatch: "linear-gradient(120deg,#9333ea,#c026d3)" },
  { id: "sand", name: "Sand", blurb: "Desert neutral · warm", swatch: "linear-gradient(120deg,#faf7f2,#9a7b4f)" },
  { id: "aqua", name: "Aqua", blurb: "Teal · rounded chips", swatch: "linear-gradient(120deg,#0d9488,#14b8a6)" },
  { id: "graphite", name: "Graphite", blurb: "Grayscale · orange accent", swatch: "linear-gradient(120deg,#1b1d21,#ea580c)" },

  // Executive line
  { id: "oxford", name: "Oxford", blurb: "Navy + bronze · double-rule crest", swatch: "linear-gradient(120deg,#16233b,#a9803f)" },
  { id: "bordeaux", name: "Bordeaux", blurb: "Oxblood wine · classic serif", swatch: "linear-gradient(120deg,#7a2230,#2a1b1e)" },
  { id: "sterling", name: "Sterling", blurb: "Charcoal + steel · tracked caps", swatch: "linear-gradient(120deg,#22262c,#51607a)" },
  { id: "imperial", name: "Imperial", blurb: "Black + champagne gold banner", swatch: "linear-gradient(120deg,#0b0c10,#b08d4c)" },
  { id: "consul", name: "Consul", blurb: "Graphite + deep teal · serif", swatch: "linear-gradient(120deg,#1c2126,#0f6b6b)" },
];

export function getTemplateInfo(id: string): TemplateInfo | undefined {
  return TEMPLATE_CATALOG.find((t) => t.id === id);
}
