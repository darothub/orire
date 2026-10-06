import { describe, it, expect } from "vitest";
import { demoTemplates, demoTemplateIds, demoTemplatesAreValid } from "@/components/landing/demo";
import { TEMPLATES } from "@/components/templates/registry";

describe("demo templates", () => {
  it("offers six curated options", () => {
    expect(demoTemplateIds()).toHaveLength(6);
    expect(demoTemplates()).toHaveLength(6);
  });

  it("only references real, distinct registry templates", () => {
    expect(demoTemplatesAreValid()).toBe(true);
    const ids = demoTemplateIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves name, blurb and swatch from the canonical registry", () => {
    for (const d of demoTemplates()) {
      const real = TEMPLATES.find((t) => t.id === d.id)!;
      expect(d.name).toBe(real.name);
      expect(d.blurb).toBe(real.blurb);
      expect(d.swatch).toBe(real.swatch);
    }
  });

  it("returns a fresh array each call", () => {
    expect(demoTemplateIds()).not.toBe(demoTemplateIds());
  });
});
