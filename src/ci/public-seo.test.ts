import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { metadata as templateIndexMetadata } from "@/app/templates/page";
import { generateMetadata, generateStaticParams } from "@/app/templates/[id]/page";
import { TEMPLATE_CATALOG } from "@/lib/templates/catalog";
import { GUIDES, isPublishedGuide } from "@/lib/content/guides";
import { generateMetadata as guideMetadata } from "@/app/guides/[slug]/page";
import { metadata as guidesMetadata } from "@/app/guides/page";
import { publicMetadata, privateMetadata } from "@/lib/seo/metadata";

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

  it("does not fabricate modification dates for pages with unknown update times", () => {
    const first = sitemap();
    const second = sitemap();
    expect(first.length).toBeGreaterThan(0);
    expect(first.every((entry) => entry.lastModified === undefined)).toBe(true);
    expect(second).toEqual(first);
  });

  it("includes every published guide, with no private or duplicate sitemap entries", () => {
    const urls = sitemap().map((entry) => entry.url);
    for (const guide of GUIDES) {
      if (isPublishedGuide(guide.slug)) {
        expect(urls).toContain(`https://orire.app/guides/${guide.slug}`);
      } else {
        expect(urls).not.toContain(`https://orire.app/guides/${guide.slug}`);
      }
    }
    expect(urls).not.toContain("https://orire.app/account");
    expect(urls).not.toContain("https://orire.app/editor");
  });

  it("noindexes unfinished editorial guide scaffolds without hiding completed guides", async () => {
    for (const guide of GUIDES) {
      const result = await guideMetadata({ params: Promise.resolve({ slug: guide.slug }) });
      if (isPublishedGuide(guide.slug)) {
        expect(result.robots).not.toMatchObject({ index: false });
        expect(result.alternates?.canonical).toBe(`/guides/${guide.slug}`);
      } else {
        expect(result.robots).toMatchObject({ index: false, follow: false });
        expect(result.alternates?.canonical).toEqual(null);
      }
    }
  });

  it("keeps public canonical and social URL consistent, and private pages nonindexable", () => {
    const publicPage = publicMetadata("CV guide | Orire", "Useful factual CV advice.", "/guides");
    expect(publicPage.alternates?.canonical).toBe("/guides");
    expect(publicPage.openGraph).toMatchObject({
      url: "/guides",
      title: publicPage.title,
      description: publicPage.description,
    });
    expect(guidesMetadata.alternates?.canonical).toBe("/guides");
    expect(guidesMetadata.openGraph).toMatchObject({ url: "/guides" });
    const userPage = privateMetadata("Your CV");
    expect(userPage.robots).toMatchObject({ index: false, follow: false, nocache: true });
    expect(userPage.alternates?.canonical).toEqual(null);
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
      expect(meta.openGraph).toMatchObject({
        title: meta.title, description: meta.description, url: `/templates/${template.id}`,
      });
      expect(meta.twitter).toMatchObject({ title: meta.title, description: meta.description });
      descriptions.add(meta.description as string);
    }
    expect(descriptions.size).toBe(TEMPLATE_CATALOG.length);
  });
});
