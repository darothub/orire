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
          if (path === "/") {
            await page.locator("#templates").scrollIntoViewIfNeeded();
            const contrast = await page.locator(".landing-gallery-name").first().evaluate((heading) => {
              const luminance = (color: string) => {
                const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => {
                  const channel = value / 255;
                  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
                });
                return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
              };
              const ink = luminance(getComputedStyle(heading).color);
              const background = luminance(getComputedStyle(heading.closest(".landing-gallery-card")!).backgroundColor);
              return (Math.max(ink, background) + 0.05) / (Math.min(ink, background) + 0.05);
            });
            expect(contrast, "Gallery names must remain readable on their actual card background").toBeGreaterThanOrEqual(4.5);
            await audit(page, testInfo, "public-gallery");
          }
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
          // Capture the same document that axe audited. Choosing a showcase
          // template below replaces its persona and animates old editor cards
          // out; scrolling one of those departing cards can race its removal.
          if (colorScheme === "dark" && ["Edit", "Grade", "AI Settings"].includes(view)) {
            if (view === "Edit") await appPage.locator(".ed-card .ed-label").first().scrollIntoViewIfNeeded();
            await appPage.screenshot({ path: testInfo.outputPath(`actual-${view}-${viewport.width}.png`), animations: "disabled" });
          }
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
            if (viewport.width < 800) {
              await pane.getByRole("tab", { name: "Edit" }).click();
              await expect(pane.getByRole("tab", { name: "Edit" })).toHaveAttribute("aria-selected", "true");
            }
          }
        });
      }
    });
  }
}
