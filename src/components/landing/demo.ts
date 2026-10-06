import { TEMPLATES, getTemplate } from "@/components/templates/registry";

/** Curated, visually distinct templates for the pre-signup live demo. */
const DEMO_IDS = ["aurora", "noir", "imperial", "carbon", "marigold", "consul"] as const;

export type DemoTemplate = {
  id: string;
  name: string;
  blurb: string;
  swatch: string;
};

/**
 * The template options offered in the landing live demo, resolved against the
 * canonical registry so names/swatches never drift from the real product.
 */
export function demoTemplates(): DemoTemplate[] {
  return DEMO_IDS.map((id) => {
    const t = getTemplate(id);
    return { id: t.id, name: t.name, blurb: t.blurb, swatch: t.swatch };
  });
}

export function demoTemplateIds(): string[] {
  return [...DEMO_IDS];
}

/** True when every curated demo id resolves to a real, distinct registry template. */
export function demoTemplatesAreValid(): boolean {
  const known = new Set(TEMPLATES.map((t) => t.id));
  return DEMO_IDS.every((id) => known.has(id));
}
