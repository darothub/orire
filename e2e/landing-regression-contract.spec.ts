import { test, expect } from "@playwright/test";

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
        // Preserve a later explicit theme choice across reloads.
        if (!localStorage.getItem("orire-theme")) localStorage.setItem("orire-theme", "dark");
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

    test("@smoke keyboard theme choice preserves actual theme surface after reload", async ({ page }) => {
      const header = page.locator(".landing-nav");
      const theme = page.getByRole("button", { name: "Switch to light theme" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await theme.focus();
      await expect(theme).toBeFocused();
      const darkBaseline = await theme.screenshot({ animations: "disabled", caret: "hide", scale: "css" });
      const darkColors = await theme.evaluate((button) => {
        const style = getComputedStyle(button);
        return { background: style.backgroundColor, text: style.color, border: style.borderColor };
      });
      await expect(page.locator(".landing-hero-inner")).toHaveCSS("transform", "none");
      const dark = await page.screenshot({ path: `test-results/ux96/BEFORE-theme-toggle-${viewport.name}.png`, animations: "disabled", caret: "hide", scale: "css" });
      await test.info().attach("BEFORE actual dark landing " + viewport.name, { body: dark, contentType: "image/png" });

      await page.keyboard.press("Enter");
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      const lightToggle = page.getByRole("button", { name: "Switch to dark theme" });
      await expect(lightToggle).toBeFocused();
      expect(await page.evaluate(() => localStorage.getItem("orire-theme"))).toBe("light");
      const lightHeader = await header.screenshot({ animations: "disabled", caret: "hide", scale: "css" });
      const lightBaseline = await lightToggle.screenshot({ animations: "disabled", caret: "hide", scale: "css" });
      expect(lightBaseline.equals(darkBaseline), "Theme choice must change the actual rendered theme control").toBe(false);
      const lightColors = await lightToggle.evaluate((button) => {
        const style = getComputedStyle(button);
        return { background: style.backgroundColor, text: style.color, border: style.borderColor };
      });
      // The landing deliberately retains its dark branding in both themes.
      // Check the theme-aware control's actual colors so an icon swap alone
      // cannot satisfy the screenshot-difference assertion above.
      expect(lightColors.background).not.toBe(darkColors.background);
      expect(lightColors.text).not.toBe(darkColors.text);
      expect(lightColors.border).not.toBe(darkColors.border);
      const light = await page.screenshot({ path: `test-results/ux96/AFTER-theme-toggle-${viewport.name}.png`, animations: "disabled", caret: "hide", scale: "css" });
      await test.info().attach("AFTER actual light landing " + viewport.name, { body: light, contentType: "image/png" });

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      const restoredToggle = page.getByRole("button", { name: "Switch to dark theme" });
      await restoredToggle.focus();
      const restoredHeader = await header.screenshot({ animations: "disabled", caret: "hide", scale: "css" });
      const restored = await restoredToggle.screenshot({ animations: "disabled", caret: "hide", scale: "css" });
      const restoredColors = await restoredToggle.evaluate((button) => {
        const style = getComputedStyle(button);
        return { background: style.backgroundColor, text: style.color, border: style.borderColor };
      });
      expect(restoredColors).toEqual(lightColors);
      await test.info().attach("Light header before reload", { body: lightHeader, contentType: "image/png" });
      await test.info().attach("Light header after reload", { body: restoredHeader, contentType: "image/png" });
      await test.info().attach("Light theme-control baseline", { body: lightBaseline, contentType: "image/png" });
      await test.info().attach("Light theme control after reload", { body: restored, contentType: "image/png" });
      expect(restored.equals(lightBaseline), "Reload must retain the same-browser light theme-control screenshot baseline").toBe(true);
    });
  });
}
