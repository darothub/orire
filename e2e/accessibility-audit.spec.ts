import AxeBuilder from "@axe-core/playwright";
import { test, expect, waitForShell } from "./fixtures";
import type { Page, TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";

async function audit(page: Page, testInfo: TestInfo, state: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const path = testInfo.outputPath(`axe-${state}.json`);
  await writeFile(path, JSON.stringify(results, null, 2));
  await testInfo.attach(`axe-${state}.json`, {
    path, contentType: "application/json",
  });
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  expect(results.incomplete.filter((result) => ["aria-prohibited-attr", "aria-hidden-focus"].includes(result.id))).toEqual([]);
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  for (const colorScheme of ["dark", "light"] as const) {
    test.describe(`WCAG audit ${viewport.width}px ${colorScheme}`, () => {
      test.use({ viewport, colorScheme, reducedMotion: "reduce" });
      test.beforeEach(async ({ context }) => {
        await context.addInitScript(() => localStorage.setItem("orire-consent", "denied"));
      });
      for (const path of ["/", "/templates", "/templates/aurora", "/support", "/forgot", "/reset?token=fictional-audit-token"]) {
        test(`public ${path}`, async ({ page }, testInfo) => {
          await page.goto(path, { waitUntil: "networkidle" });
          await audit(page, testInfo, "public");
        });
      }
      test("signup keyboard reveal, modal focus and WCAG", async ({ page }, testInfo) => {
        await page.goto("/");
        const opener = page.getByRole("button", { name: "Create your CV" }).first();
        await opener.click();
        const dialog = page.getByRole("dialog", { name: "Create your account" });
        await expect(dialog).toBeVisible();
        await expect(page.locator(".auth-showcase")).toHaveAttribute("inert", "");
        await expect(dialog.locator('input[type="email"]')).toBeFocused();
        const password = dialog.locator(".pw-input");
        await password.fill("FictionalAuditPass123");
        await password.focus();
        await page.keyboard.press("Tab");
        const reveal = dialog.getByRole("button", { name: "Show password", exact: true });
        await expect(reveal).toBeFocused();
        await expect(reveal).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        await expect(password).toHaveAttribute("type", "text");
        await expect(dialog.getByRole("button", { name: "Hide password", exact: true })).toHaveAttribute("aria-pressed", "true");
        await expect(dialog.getByRole("button", { name: "Hide password", exact: true })).toBeFocused();
        await page.keyboard.press("Space");
        await expect(password).toHaveAttribute("type", "password");
        await audit(page, testInfo, "signup");
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(opener).toBeFocused();
      });
      for (const view of ["Home", "Edit", "Grade", "Export", "AI Settings"]) {
        test(`workspace ${view}`, async ({ appPage }, testInfo) => {
          await waitForShell(appPage);
          if (view !== "Home") {
            await appPage.getByRole("navigation", { name: "Workspaces" }).getByRole("button", { name: view, exact: true }).click();
          }
          const title = view === "Home" ? "Your CV studio" : view;
          await expect(appPage.getByRole("heading", { name: title, exact: true })).toBeVisible();
          // Audit the settled surface, rather than colors blended mid-entrance.
          await expect(appPage.locator(".ws-view")).toHaveCSS("opacity", "1");
          if (view === "AI Settings") {
            for (const card of await appPage.locator(".conn-card").all()) {
              await expect(card).toHaveCSS("opacity", "1");
            }
          }
          await audit(appPage, testInfo, "workspace");
          if (view === "Edit") {
            const pane = appPage.getByRole("tablist", { name: "Switch pane" });
            if (viewport.width < 800) {
              await pane.getByRole("tab", { name: "Preview" }).click();
              await audit(appPage, testInfo, "preview");
            }
            const thumbnails = appPage.locator(".pick-thumb");
            await expect(thumbnails.first()).toHaveAttribute("inert", "");
            const second = appPage.locator(".pick-card").nth(1);
            await second.focus();
            await appPage.keyboard.press("Enter");
            await expect(second).toHaveAttribute("aria-pressed", "true");
          }
          if (colorScheme === "dark" && ["Edit", "Grade", "AI Settings"].includes(view)) {
            if (view === "Edit" && viewport.width < 800) {
              await appPage.getByRole("tablist", { name: "Switch pane" }).getByRole("tab", { name: "Edit" }).click();
            }
            if (view === "Edit") await appPage.locator(".ed-card .ed-label").first().scrollIntoViewIfNeeded();
            await appPage.screenshot({ path: testInfo.outputPath(`actual-${view}-${viewport.width}.png`), animations: "disabled" });
          }
        });
      }
    });
  }
}
