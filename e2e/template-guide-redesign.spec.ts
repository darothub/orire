import { test, expect } from "@playwright/test";

const GUIDE = "/guides/choose-the-right-cv-template";
const cases = [
  { name: "desktop-1440x900-dark", width: 1440, height: 900, scheme: "dark" },
  { name: "mobile-390x844-dark", width: 390, height: 844, scheme: "dark" },
  { name: "narrow-320x720-dark", width: 320, height: 720, scheme: "dark" },
  { name: "mobile-390x844-light", width: 390, height: 844, scheme: "light" },
] as const;

for (const sample of cases) {
  test("UX107 real implemented guide " + sample.name, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: sample.width, height: sample.height });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: sample.scheme });
    await page.goto(GUIDE, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", {
      level: 1,
      name: "Pick a CV template that puts your experience first.",
    })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Outline — section headings and notes are in place", { exact: false }))
      .toHaveCount(0);
    await expect(page.locator(".guide-draft,.guide-outline")).toHaveCount(0);

    // CookieBanner hydrates after the first server paint. Wait briefly for the
    // real consent control instead of racing isVisible() before hydration; all
    // captured screenshots must show the page itself, not a consent overlay.
    const consent = page.getByRole("button", { name: "Decline", exact: true });
    await consent.waitFor({ state: "visible", timeout: 3500 }).catch(() => {});
    if (await consent.isVisible().catch(() => false)) {
      await consent.click();
      await expect(consent).toBeHidden();
    }
    await page.evaluate(() => document.fonts.ready);

    // CV thumbnails contain their own decorative document headings, which are
    // inert/aria-hidden. Count the ACCESSIBLE page heading, not hidden markup.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", {
      level: 2,
      name: "One CV. Three different first impressions.",
    })).toBeVisible();

    const cards = page.locator(".ux107-card");
    await expect(cards).toHaveCount(3);
    const templateIds = ["meridian", "oxford", "vertex"] as const;
    const templateNames = ["Meridian", "Oxford", "Vertex"] as const;

    for (let index = 0; index < templateIds.length; index++) {
      const card = cards.nth(index);
      const id = templateIds[index];
      const name = templateNames[index];
      await expect(card.getByRole("heading", { name, exact: true })).toBeVisible();
      await expect(card.getByRole("img", {
        name: new RegExp("real Orire " + name + " template"),
      })).toBeVisible();
      await expect(card.locator(".ux107-paper-inner")).toContainText("Ada Okonkwo");
      await expect(card.locator(".ux107-paper-stage")).toHaveAttribute("inert", "");
      await expect(card.getByRole("link", { name: "Preview " + name + " CV template" }))
        .toHaveAttribute("href", "/templates/" + id);

      // Test actual rendered CV bounds; a transform bug must not silently cut
      // off the document's left or right edge within the thumbnail viewport.
      const bounds = await card.evaluate((el) => {
        const stage = el.querySelector(".ux107-paper-stage")!.getBoundingClientRect();
        const paper = el.querySelector(".ux107-paper-inner")!.getBoundingClientRect();
        return {
          stageWidth: stage.width, paperWidth: paper.width,
          leftGap: paper.left - stage.left, rightGap: stage.right - paper.right,
          fits: paper.left >= stage.left - 2 && paper.right <= stage.right + 2,
        };
      });
      console.log("UX107_PREVIEW " + sample.name + " " + name + ": " + JSON.stringify(bounds));
      expect(bounds.fits).toBe(true);
      expect(Math.abs(bounds.leftGap - bounds.rightGap)).toBeLessThan(3);
    }

    await expect(page.getByRole("link", { name: /Explore all \d+ templates/ }))
      .toHaveAttribute("href", "/templates");
    await expect(page.getByRole("link", { name: /Compare 3 real designs/ }))
      .toHaveAttribute("href", "#compare-designs");
    await expect(page.getByRole("link", { name: "Start building your CV" }))
      .toHaveAttribute("href", "/");

    // The design works on very narrow screens without whole-page overflow.
    const pageOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    expect(pageOverflow).toBe(false);
    expect(errors).toEqual([]);

    const out = "test-results/ux107-implemented/";
    await page.screenshot({
      path: out + "AFTER-IMPLEMENTED-guide-" + sample.name + "-first-view.png",
      animations: "disabled",
    });
    await page.screenshot({
      path: out + "AFTER-IMPLEMENTED-guide-" + sample.name + "-full.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.locator("#compare-designs").screenshot({
      path: out + "AFTER-IMPLEMENTED-real-CV-comparison-" + sample.name + ".png",
      animations: "disabled",
    });
  });
}

test("UX107 keyboard section jump and real template destination", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(GUIDE, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: /Compare 3 real designs/ }).click();
  await expect(page).toHaveURL(/#compare-designs$/);
  await expect(page.getByRole("heading", {
    name: "One CV. Three different first impressions.",
  })).toBeInViewport();

  const oxford = page.getByRole("link", { name: "Preview Oxford CV template" });
  await oxford.focus();
  // Use genuine keyboard focus (not only element.focus(), which need not
  // match :focus-visible in Chromium without a keyboard interaction).
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(oxford).toBeFocused();
  const ring = await oxford.evaluate(el => getComputedStyle(el).outlineStyle);
  expect(ring).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/templates\/oxford$/);
  await expect(page.getByRole("heading", { name: "Oxford CV template" })).toBeVisible();
});

test("UX107 other unfinished guide remains unchanged", async ({ page }) => {
  await page.goto("/guides/tailor-cv-to-job-description", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", {
    name: "How to tailor your CV to a job description",
  })).toBeVisible();
  await expect(page.locator(".guide-draft")).toBeVisible();
  await expect(page.locator(".ux107-card")).toHaveCount(0);
});
