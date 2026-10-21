import { test, expect } from "@playwright/test";

/**
 * Regression for the public gallery containing actual CV template renderers.
 * The rendered CVs have their own anchors, so the enclosing gallery card must
 * never be an anchor itself. Invalid nested anchors can force React hydration
 * to discard server HTML and can surface secondary script warnings.
 */
test("anonymous homepage template gallery has valid anchors and hydrates cleanly", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      const text = message.text();
      if (/hydration|<a> cannot|script tag while rendering/i.test(text)) {
        errors.push(text);
      }
    }
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Build a CV that makes your experience stand out." })).toBeVisible();

  const cards = page.locator(".landing-gallery-card");
  await expect(cards).toHaveCount(3);
  await expect(page.locator(".landing-gallery-card a a")).toHaveCount(0);
  await expect(page.locator(".landing-gallery-card > a")).toHaveCount(3);

  for (const card of await cards.all()) {
    await expect(card.locator(".landing-gallery-art")).toHaveAttribute("inert", "");
    await expect(card.locator(".landing-gallery-template")).toBeAttached();
    await expect(card.locator(".landing-gallery-action")).toHaveAttribute("href", /\/templates\//);
  }

  expect(errors, "Unexpected hydration or script warning").toEqual([]);
});
