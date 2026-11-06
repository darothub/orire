import { test, expect } from "./fixtures";

const sections = [
  { name: "How it works", id: "how" },
  { name: "Templates", id: "templates" },
  { name: "Live demo", id: "demo" },
  { name: "Pricing", id: "pricing" },
] as const;

for (const viewport of [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
]) {
  test.describe("anonymous landing regression " + viewport.name, () => {
    test.use({ viewport, colorScheme: "dark", reducedMotion: "reduce", locale: "en-GB", timezoneId: "UTC" });
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem("orire-consent", "denied");
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.evaluate(() => document.fonts.ready);
    });

    test("@smoke every section navigation link reaches its real destination", async ({ page }) => {
      for (const section of sections) {
        if (viewport.width < 860) {
          // Each preceding navigation must have closed the mobile menu.
          await page.getByRole("button", { name: "Open section menu" }).click();
        }
        const nav = page.getByRole("navigation", { name: viewport.width < 860 ? "Mobile page sections" : "Sections", exact: true });
        const link = nav.getByRole("link", { name: section.name, exact: true });
        await expect(link).toHaveAttribute("href", "#" + section.id);
        await link.click();
        await expect(page).toHaveURL(new RegExp("#" + section.id + "$"));
        const target = page.locator("#" + section.id);
        await expect(target).toHaveCount(1);
        await expect(target).toBeInViewport();
        if (viewport.width < 860) await expect(nav).toBeHidden();
      }
    });

    test("@smoke stays dark with no theme toggle, even if a light choice was stored", async ({ page }) => {
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await expect(page.getByRole("button", { name: /Switch to (light|dark) theme/ })).toHaveCount(0);

      await page.evaluate(() => localStorage.setItem("orire-theme", "light"));
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    });
  });
}
