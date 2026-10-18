import { describe, it, expect } from "vitest";
import { trustStats } from "@/components/landing/trust";
import { TEMPLATE_COUNT } from "@/lib/templates/catalog";

describe("trustStats", () => {
  it("returns four stats", () => {
    expect(trustStats()).toHaveLength(4);
  });

  it("has a non-empty value and label for every stat", () => {
    for (const s of trustStats()) {
      expect(s.value.trim().length).toBeGreaterThan(0);
      expect(s.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("returns a fresh copy each call (no shared mutation)", () => {
    const a = trustStats();
    a[0].value = "mutated";
    expect(trustStats()[0].value).not.toBe("mutated");
  });

  it("surfaces the core proof points (templates and AI comparison)", () => {
    const labels = trustStats().map((s) => s.label.toLowerCase()).join(" ");
    expect(labels).toContain("templates");
    expect(labels).toContain("ai assistants");
  });

  it("template stat value matches the live catalog count", () => {
    const tpl = trustStats().find((s) => s.label.toLowerCase().includes("templates"));
    expect(tpl?.value).toBe(String(TEMPLATE_COUNT));
  });
});
