import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { metadata as templateIndexMetadata } from "@/app/templates/page";
import { generateMetadata, generateStaticParams } from "@/app/templates/[id]/page";
import { TEMPLATE_CATALOG } from "@/lib/templates/catalog";

/**
 * UX94: public SEO contracts. Validate actual metadata and route generators
 * without depending on the order of generated HTML attributes.
 */
describe("public SEO routes", () => {
  it("exposes unique absolute sitemap URLs for all public templates", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain("https://orire.app/");
    expect(urls).toContain("https://orire.app/templates");
    for (const template of TEMPLATE_CATALOG) {
      expect(urls).toContain(`https://orire.app/templates/${template.id}`);
    }
    expect(urls.every((url) => url.startsWith("https://"))).toBe(true);
    expect(urls.some((url) => /\/(?:api|checkout|reset|forgot)(?:\/|$)/.test(url))).toBe(false);
  });

  it("exposes a sitemap while excluding API and account recovery from crawling", () => {
    const rules = robots();
    expect(rules.sitemap).toContain("/sitemap.xml");
    expect(rules.rules).toEqual(expect.objectContaining({
      userAgent: "*",
      disallow: expect.arrayContaining(["/api/", "/checkout/", "/forgot", "/reset"]),
    }));
  });

  it("provides a canonical and descriptive metadata for every public template", async () => {
    expect(templateIndexMetadata.alternates?.canonical).toBe("/templates");
    expect(generateStaticParams().map((item) => item.id).sort()).toEqual(
      TEMPLATE_CATALOG.map((item) => item.id).sort(),
    );
    const descriptions = new Set<string>();
    for (const template of TEMPLATE_CATALOG) {
      const meta = await generateMetadata({ params: Promise.resolve({ id: template.id }) });
      expect(meta.title).toContain(template.name);
      expect(meta.alternates?.canonical).toBe(`/templates/${template.id}`);
      expect(typeof meta.description).toBe("string");
      expect((meta.description as string).trim().length).toBeGreaterThan(30);
      descriptions.add(meta.description as string);
    }
    expect(descriptions.size).toBe(TEMPLATE_CATALOG.length);
  });
});
