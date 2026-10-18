import { describe, it, expect } from "vitest";
import { TEMPLATE_CATALOG, TEMPLATE_COUNT, allTemplatesPerk } from "./catalog";
import { TEMPLATES, isAtsSafe } from "@/components/templates/registry";

describe("template catalog", () => {
  it("exports TEMPLATE_COUNT matching the catalog length with unique ids", () => {
    expect(TEMPLATE_COUNT).toBe(TEMPLATE_CATALOG.length);
    expect(TEMPLATE_COUNT).toBeGreaterThan(0);
    const ids = new Set(TEMPLATE_CATALOG.map((t) => t.id));
    expect(ids.size).toBe(TEMPLATE_COUNT);
  });

  it("allTemplatesPerk reflects the live catalog size", () => {
    expect(allTemplatesPerk()).toBe(`All ${TEMPLATE_COUNT} templates`);
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

  it("every template is classified ATS-safe or Design, and the registry flag agrees with isAtsSafe", () => {
    expect(TEMPLATES).toHaveLength(TEMPLATE_COUNT);
    for (const t of TEMPLATES) {
      expect(typeof t.ats).toBe("boolean");
      expect(t.ats).toBe(isAtsSafe(t.id));
    }
  });

  it("classifies the known single-column templates as ATS-safe and the known sidebar templates as Design", () => {
    const SINGLE_COLUMN = [
      "noir", "meridian",
      "slate", "ivory", "onyx", "sapphire", "marigold", "crimson", "nordic", "mono", "aqua", "oxford", "sterling", "imperial",
    ];
    const SIDEBAR = [
      "aurora", "vertex",
      "carbon", "coral", "verde", "frost", "plum", "sand", "graphite", "bordeaux", "consul",
    ];
    expect(SINGLE_COLUMN.length + SIDEBAR.length).toBe(TEMPLATE_COUNT);
    for (const id of SINGLE_COLUMN) expect(isAtsSafe(id)).toBe(true);
    for (const id of SIDEBAR) expect(isAtsSafe(id)).toBe(false);
  });
});
