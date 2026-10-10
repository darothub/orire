import { describe, it, expect } from "vitest";
import { TEMPLATE_CATALOG } from "./catalog";
import { TEMPLATES } from "@/components/templates/registry";

describe("template catalog", () => {
  it("has 25 templates with unique ids", () => {
    expect(TEMPLATE_CATALOG).toHaveLength(25);
    const ids = new Set(TEMPLATE_CATALOG.map((t) => t.id));
    expect(ids.size).toBe(25);
  });

  it("every catalog entry has a name, blurb and swatch", () => {
    for (const t of TEMPLATE_CATALOG) {
      expect(t.name.trim()).not.toBe("");
      expect(t.blurb.trim()).not.toBe("");
      expect(t.swatch).toMatch(/gradient/);
    }
  });

  it("registry stays in sync with the catalog (same ids, every id has a component)", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(TEMPLATE_CATALOG.map((t) => t.id));
    for (const t of TEMPLATES) expect(typeof t.Component).toBe("function");
  });
});
