import { test, expect } from "@playwright/test";

/**
 * UX94: real rendered HTML rather than metadata-object unit assertions.
 * Uses public routes only; no customer data, account or payment operations.
 */
test("public pages expose correct canonical and social metadata in rendered HTML", async ({ page }) => {
  const routes = [
    { path: "/", canonical: "https://orire.app" },
    { path: "/templates", canonical: "https://orire.app/templates" },
    { path: "/guides", canonical: "https://orire.app/guides" },
    { path: "/privacy", canonical: "https://orire.app/privacy" },
  ];
  for (const route of routes) {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", route.canonical);
    const title = await page.title();
    expect(title.trim().length, route.path).toBeGreaterThan(20);
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description?.trim().length ?? 0, route.path).toBeGreaterThan(30);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", title);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", description!);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", route.canonical);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  }
});

test("all four completed advice guides are indexable", async ({ page }) => {
  await page.goto("/guides/choose-the-right-cv-template", { waitUntil: "domcontentloaded" });
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href", "https://orire.app/guides/choose-the-right-cv-template",
  );
  const publishedRobots = page.locator('meta[name="robots"]');
  const publishedRobotsContent = await publishedRobots.count() ? await publishedRobots.getAttribute("content") : "";
  expect(publishedRobotsContent ?? "").not.toMatch(/noindex/i);

  for (const slug of ["tailor-cv-to-job-description", "quantify-achievements-on-your-cv", "beat-applicant-tracking-systems-ats"]) {
    await page.goto("/guides/" + slug, { waitUntil: "domcontentloaded" });
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://orire.app/guides/" + slug);
    const robots = page.locator('meta[name="robots"]');
    expect((await robots.count() ? await robots.getAttribute("content") : "") ?? "").not.toMatch(/noindex/i);
    await expect(page.locator(".guide-draft")).toHaveCount(0);
  }
});

test("sitemap and robots routes expose valid public SEO data", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  expect(xml).toContain("https://orire.app/templates");
  expect(xml).toContain("https://orire.app/guides/choose-the-right-cv-template");
  expect(xml).toContain("https://orire.app/guides/tailor-cv-to-job-description");
  expect(xml).not.toContain("<lastmod>");

  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  const txt = await robots.text();
  expect(txt).toContain("Sitemap: https://orire.app/sitemap.xml");
  expect(txt).toContain("Disallow: /api/");
});
