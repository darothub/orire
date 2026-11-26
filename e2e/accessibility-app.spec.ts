import AxeBuilder from "@axe-core/playwright";
import { test, expect, signIn } from "./fixtures";
import type { Page, TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";

/**
 * WCAG audit of the v4 pages under /app. DRAFT: written from the component code
 * without a running server, so a heading name or a wait may need one adjustment on
 * first run. Needs ORIRE_V4_ENABLED=true and ORIRE_OCC_ENABLED=true (the e2e user is
 * allowed in by occIsolatedE2eFixtureAllowed, as in the other OCC specs).
 */
async function audit(page: Page, testInfo: TestInfo, state: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const path = testInfo.outputPath(`axe-${state}.json`);
  await writeFile(path, JSON.stringify(results, null, 2));
  await testInfo.attach(`axe-${state}.json`, { path, contentType: "application/json" });
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

const ROUTES = [
  { path: "/app", name: "home" },
  { path: "/app/studio", name: "studio" },
  { path: "/app/studio/simulate", name: "simulate" },
  { path: "/app/studio/refine", name: "refine" },
  { path: "/app/studio/interview", name: "interview" },
  { path: "/app/copilot", name: "copilot" },
  { path: "/app/library", name: "library" },
  { path: "/app/export", name: "export" },
  { path: "/app/plan", name: "plan" },
];

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  for (const colorScheme of ["dark", "light"] as const) {
    test.describe(`v4 WCAG audit ${viewport.width}px ${colorScheme}`, () => {
      test.skip(
        process.env.ORIRE_V4_ENABLED !== "true" || process.env.ORIRE_OCC_ENABLED !== "true",
        "Run with ORIRE_V4_ENABLED=true and ORIRE_OCC_ENABLED=true",
      );
      test.use({ viewport, colorScheme, reducedMotion: "reduce" });

      test.beforeEach(async ({ context, page, db, e2eUser }) => {
        await context.addInitScript(() => localStorage.setItem("orire-consent", "denied"));
        await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
        await signIn(page);
      });

      for (const route of ROUTES) {
        test(`${route.path}`, async ({ page }, testInfo) => {
          await page.goto(route.path, { waitUntil: "networkidle" });
          await expect(page.getByRole("main")).toBeVisible();
          await audit(page, testInfo, route.name);
        });
      }

      test("menu: Classic link is reachable and the collapse control is labelled", async ({ page }) => {
        await page.goto("/app", { waitUntil: "networkidle" });
        const menu = page.getByRole("navigation", { name: "Orire" });
        await expect(menu.getByRole("link", { name: "Copilot" })).toBeVisible();
        const classic = page.getByRole("link", { name: "Classic Orire" });
        await classic.focus();
        await expect(classic).toBeFocused();
        await expect(classic).toHaveAttribute("href", "/?classic=1");
        await expect(page.getByRole("button", { name: /(Collapse|Expand) menu/ })).toBeVisible();
      });
    });
  }
}
