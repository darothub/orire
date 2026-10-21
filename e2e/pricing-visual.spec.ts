import { test, expect } from "@playwright/test";

/**
 * Public pricing visual regression on an anonymous desktop viewport.
 * Capture the actual rendered pricing section and verify its three cards share
 * a top edge, height, padding, and bottom-aligned CTA buttons.
 */
test("desktop pricing cards are consistently aligned", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const pricing = page.locator("#pricing");
  const cards = pricing.locator(".landing-price-card");

  await expect(cards).toHaveCount(3);
  await expect(pricing.getByRole("heading", { name: /Start free/ })).toBeVisible();
  await cards.last().scrollIntoViewIfNeeded();

  const geometry = await cards.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      const cta = element.querySelector<HTMLButtonElement>("button")!;
      const ctaRect = cta.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        left: rect.left,
        top: rect.top,
        height: rect.height,
        bottom: rect.bottom,
        ctaBottom: ctaRect.bottom,
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight,
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
      };
    }),
  );

  const [first, ...others] = geometry;
  for (const card of others) {
    expect(Math.abs(card.top - first.top)).toBeLessThan(2);
    expect(Math.abs(card.height - first.height)).toBeLessThan(2);
    expect(Math.abs(card.ctaBottom - first.ctaBottom)).toBeLessThan(2);
    expect(card.paddingLeft).toBe(first.paddingLeft);
    expect(card.paddingRight).toBe(first.paddingRight);
    expect(card.paddingTop).toBe(first.paddingTop);
    expect(card.paddingBottom).toBe(first.paddingBottom);
  }
  await pricing.screenshot({ path: "test-results/pricing-desktop-1440.png" });
});
