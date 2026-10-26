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


test("public detail page renders the actual fictional CV and readable CTA", async ({ page }) => {
  await page.goto("/templates/aurora", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Aurora CV template" })).toBeVisible();
  // The public CV is now explained by semantic text, not an opaque image role.
  // Keep the visual render check and assert the accessible fictional summary.
  await expect(page.locator(".tpl-detail-preview .sr-only")).toContainText("Ada Okonkwo");
  await expect(page.locator(".tpl-detail-preview .sr-only")).toContainText("Example candidate:");
  await expect(page.locator(".tpl-detail-preview-paper")).toContainText("Ada Okonkwo");

  const cta = page.getByRole("link", { name: /Create your CV with Aurora/ });
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", "/");

  // Shared-content link styles must not override the CTA's high-contrast ink.
  const contrast = await cta.evaluate((el) => {
    const css = window.getComputedStyle(el);
    return { color: css.color, background: css.backgroundImage };
  });
  expect(contrast.color).toBe("rgb(8, 21, 18)");
  expect(contrast.background).toContain("gradient");
});

test("gallery preview preserves original template text alignment", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const documents = page.locator(".landing-gallery-template.paper");
  await expect(documents).toHaveCount(3);
  for (const doc of await documents.all()) {
    await expect(doc).toHaveCSS("text-align", "left");
  }
});
