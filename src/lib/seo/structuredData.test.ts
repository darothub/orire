import { describe, it, expect } from "vitest";
import { buildStructuredData } from "./structuredData";
import { PLAN_ORDER } from "@/lib/plan/plan";

describe("buildStructuredData", () => {
  const data = buildStructuredData("https://orire.app");
  const graph = data["@graph"];
  const app = graph.find((n) => n["@type"] === "SoftwareApplication") as Record<string, unknown>;

  it("declares the schema.org context", () => {
    expect(data["@context"]).toBe("https://schema.org");
  });

  it("includes Organization, WebSite and SoftwareApplication nodes", () => {
    const types = graph.map((n) => n["@type"]);
    expect(types).toContain("Organization");
    expect(types).toContain("WebSite");
    expect(types).toContain("SoftwareApplication");
  });

  it("emits one Offer per plan with a USD price", () => {
    const offers = app.offers as Array<Record<string, unknown>>;
    expect(offers).toHaveLength(PLAN_ORDER.length);
    for (const o of offers) {
      expect(o.priceCurrency).toBe("USD");
      expect(String(o.price)).toMatch(/^\d+\.\d{2}$/);
    }
  });

  it("never emits aggregateRating or review (testimonials are unverified)", () => {
    const json = JSON.stringify(data).toLowerCase();
    expect(json).not.toContain("aggregaterating");
    expect(json).not.toContain('"review"');
    expect(json).not.toContain("ratingvalue");
  });

  it("tolerates a trailing slash in the site URL", () => {
    const d = buildStructuredData("https://orire.app/");
    const org = d["@graph"].find((n) => n["@type"] === "Organization") as Record<string, unknown>;
    expect(org["@id"]).toBe("https://orire.app/#organization");
  });
});
