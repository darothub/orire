import { expect, test } from "@playwright/test";

const publicPages = ["/", "/templates", "/templates/aurora", "/guides", "/guides/choose-the-right-cv-template", "/privacy", "/terms", "/support"];

test.describe("public metadata rendered by Next", () => {
  for (const path of publicPages) {
    test(`canonical and social previews describe ${path}`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      const title = await page.title();
      const description = await page.locator('meta[name="description"]').getAttribute("content");
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(new URL(canonical!).pathname).toBe(path);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", canonical!);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", title);
      await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", description!);
      await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", title);
      await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute("content", description!);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      const robotsTag = page.locator('meta[name="robots"]');
      const robots = await robotsTag.count() ? await robotsTag.getAttribute("content") : "";
      expect(robots ?? "").not.toContain("noindex");
      const structuredData = await page.locator('script[type="application/ld+json"]').allTextContents();
      for (const json of structuredData) {
        expect(() => JSON.parse(json)).not.toThrow();
        expect(json).not.toMatch(/aggregateRating|ratingValue|"review"/);
      }
    });
  }

  for (const path of ["/forgot", "/reset"]) {
    test(`account recovery ${path} is not indexable`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    });
  }
});
