import { test, expect } from "@playwright/test";
import { test as authenticatedTest } from "./fixtures";

/**
 * UX #92 first accessibility pass: keyboard navigation and text alternatives.
 * Captures genuine Chromium screenshots of focus-only skip link and CV dialog.
 * The skip control does not change Orire's normal pointer-first appearance.
 */
for (const viewport of [
  { width: 390, height: 844, id: "mobile-390" },
  { width: 1440, height: 900, id: "desktop-1440" },
]) {
  test("public landing keyboard skip and accessible demo " + viewport.id, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", {
      name: "Build a CV that makes your experience stand out.",
    })).toBeVisible();

    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toHaveCount(1);
    await expect(skip).toHaveAttribute("href", "#main-content");
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();

    const focusStyle = await skip.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth) };
    });
    expect(focusStyle.outlineStyle).not.toBe("none");
    expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(2);

    await page.screenshot({
      path: "test-results/ux92-a11y/AFTER-skip-link-focused-" + viewport.id + ".png",
      animations: "disabled",
    });
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main-content")).toBeFocused();

    const consent = page.getByRole("dialog", { name: "Cookie consent" });
    if (await consent.isVisible()) {
      await consent.getByRole("button", { name: "Decline" }).click();
    }

    const previewStatus = page.locator("#demo [role='status']");
    await expect(previewStatus).toHaveAttribute("aria-live", "polite");
    const noir = page.locator("#demo .landing-demo-rail").getByRole("button", { name: /Noir/ });
    await noir.click();
    await expect(noir).toHaveAttribute("aria-pressed", "true");
    await expect(previewStatus).toContainText("Noir");

    const enlargeButton = page.locator("#demo").getByRole("button", { name: /Enlarge .* CV preview/ });
    await enlargeButton.click();
    const dialog = page.getByRole("dialog", { name: /full-size CV preview/ });
    await expect(dialog).toBeVisible();
    const textAlternative = dialog.getByRole("region", { name: "Fictional CV text alternative" });
    await expect(textAlternative).toBeAttached();
    await expect(textAlternative).toContainText("Ada Okonkwo");
    await expect(textAlternative).toContainText("Senior Product Designer");
    await expect(textAlternative).toContainText("Experience");
    await expect(textAlternative).toContainText("Education");
    await expect(textAlternative).toContainText("Skills");
    await expect(dialog.locator(".landing-demo-full-paper")).toHaveAttribute("inert", "");
    await page.screenshot({
      path: "test-results/ux92-a11y/AFTER-screenreader-CV-dialog-" + viewport.id + ".png",
      animations: "disabled",
    });

    // A modal must contain sequential keyboard focus, including reverse Tab.
    // Exercise actual browser keyboard navigation instead of inspecting only
    // aria-modal markup. Run enough steps to traverse/wrap short dialogs.
    for (const key of ["Tab", "Shift+Tab"] as const) {
      for (let index = 0; index < 8; index++) {
        await page.keyboard.press(key);
        const focusInsideDialog = await dialog.evaluate(
          (element) => element.contains(document.activeElement),
        );
        expect(focusInsideDialog, `Focus escaped the CV preview dialog on ${key}, step ${index + 1}`).toBe(true);
      }
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    // A modal must return keyboard focus to the control that opened it.
    // This is a behavioral regression check: no visual product change.
    await expect(enlargeButton).toBeFocused();
    expect(errors).toEqual([]);
  });
}

authenticatedTest("authenticated CV workspace has keyboard skip-to-main link", async ({ appPage }) => {
  const skip = appPage.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toHaveCount(1);
  await expect(skip).toHaveAttribute("href", "#main-content");
  await expect(appPage.locator("main#main-content")).toHaveCount(1);
  await skip.focus();
  await expect(skip).toBeFocused();
  await appPage.keyboard.press("Enter");
  await expect(appPage.locator("main#main-content")).toBeFocused();
});
