import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures";

const contactURL = "https://www.instagram.com/orire.app/";
const routes = [
  { path: "/privacy", heading: "Privacy Policy" },
  { path: "/terms", heading: "Terms of Service" },
  { path: "/support", heading: "Support" },
] as const;

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  for (const colorScheme of ["dark", "light"] as const) {
    test.describe(`UX95 public policies ${viewport.width}px ${colorScheme}`, () => {
      test.use({ viewport, colorScheme, reducedMotion: "reduce" });
      test.beforeEach(async ({ context }) => {
        await context.addInitScript(() => localStorage.setItem("orire-consent", "denied"));
      });

      for (const route of routes) {
        test(`${route.path} exposes the owner-confirmed contact accessibly`, async ({ page }) => {
          const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
          expect(response?.status()).toBe(200);
          await expect(page.getByRole("heading", { name: route.heading, exact: true })).toBeVisible();
          const contacts = page.getByRole("link", { name: /@orire\.app/ });
          expect(await contacts.count()).toBeGreaterThan(0);
          for (const contact of await contacts.all()) {
            await expect(contact).toHaveAttribute("href", contactURL);
          }
          await expect(page.locator('a[href="mailto:privacy@orire.app"], a[href="mailto:support@orire.app"]')).toHaveCount(0);
          await contacts.first().focus();
          await page.keyboard.press("Shift+Tab");
          await page.keyboard.press("Tab");
          await expect(contacts.first()).toBeFocused();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
          expect(audit.violations, JSON.stringify(audit.violations, null, 2)).toEqual([]);
        });
      }
    });
  }

  test(`public footer policy links work using the keyboard at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await context.addInitScript(() => localStorage.setItem("orire-consent", "denied"));
    for (const route of routes) {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const footer = page.getByRole("contentinfo");
      const link = footer.locator(`a[href="${route.path}"]`);
      await link.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(link).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`${route.path}$`));
      await expect(page.getByRole("heading", { name: route.heading, exact: true })).toBeVisible();
    }
  });
}

test("privacy explains the confirmed operator, retention and limited export/deletion scope", async ({ page }) => {
  await page.goto("/privacy", { waitUntil: "domcontentloaded" });
  const main = page.getByRole("main");
  await expect(main).toContainText("Bogini");
  await expect(main).toContainText("Porto, Portugal");
  await expect(main).not.toContainText("registered office");
  for (const policy of ["30 days", "10 years", "90 days", "OpenAI", "Anthropic", "Export my data", "Delete account"]) {
    await expect(main).toContainText(policy);
  }
  await expect(main).toContainText(/browser.*storage|storage.*browser/i);
  await expect(main).not.toContainText("download all your data");
  await expect(main).not.toContainText("delete your account and all associated data");
  await page.goto("/support", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("main")).toContainText(/do not send/i);
  await expect(page.getByRole("main")).toContainText(/passwords/i);
  await expect(page.getByRole("main")).toContainText(/CVs/);
  await expect(page.getByRole("main")).toContainText(/payment details/i);
});
