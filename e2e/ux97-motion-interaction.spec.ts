import { test, expect } from "./fixtures";

/** UX97 reduced-motion and interactive-state regression at real viewports. */
for (const viewport of [
  { width: 1440, height: 900, name: "desktop" },
  { width: 390, height: 844, name: "mobile" },
]) {
  test("hero and demo remain functional with reduced motion " + viewport.name, async ({ page }, testInfo) => {
    await page.addInitScript(() => localStorage.setItem("orire-consent", "denied"));
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toBeVisible();
    const cta = page.getByRole("button", { name: /Create your CV/ }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toBeEnabled();
    await expect(page.locator(".landing-hero-inner")).toHaveCSS("opacity", "1");
    await expect(page.locator(".landing-hero-inner")).toHaveCSS("transform", "none");
    await expect(page.locator(".landing-hero-inner")).toHaveCSS("filter", "none");
    const animatedSections = await page.locator(".landing-motion-reveal").evaluateAll((nodes) => nodes.map((node) => {
      const style = getComputedStyle(node);
      return { opacity: style.opacity, transform: style.transform, filter: style.filter };
    }));
    expect(animatedSections.length).toBeGreaterThan(0);
    expect(animatedSections.filter((style) => style.opacity !== "1" || style.transform !== "none" || style.filter !== "none")).toEqual([]);
    await cta.hover();
    await expect(cta).toHaveCSS("transform", "none");
    await expect(cta).toHaveCSS("transition-duration", "0s");
    await cta.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(cta).toBeFocused();
    await expect(cta).toHaveCSS("outline-style", "solid");
    await expect(cta).toHaveCSS("outline-width", "3px");
    await expect(cta).toHaveCSS("outline-color", "rgb(58, 217, 180)");
    await page.keyboard.down("Space");
    await expect(cta).toHaveCSS("filter", "brightness(0.92)");
    await page.keyboard.up("Space");
    await expect(page.getByRole("dialog", { name: "Create your account" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(cta).toBeFocused();
    await page.locator("#demo").scrollIntoViewIfNeeded();
    const options = page.getByRole("group", { name: "Demo templates" });
    const buttons = options.getByRole("button");
    await expect(buttons.first()).toBeVisible();
    const second = buttons.nth(1);
    await second.click();
    await expect(second).toHaveAttribute("aria-pressed", "true");
    await second.hover();
    await expect(second).toHaveCSS("transform", "none");
    await expect(second).toHaveCSS("transition-duration", "0s");
    await second.focus();
    await page.keyboard.press("Tab");
    const third = buttons.nth(2);
    await expect(third).toBeFocused();
    await expect(third).toHaveCSS("outline-color", "rgb(58, 217, 180)");
    await page.keyboard.press("Enter");
    await expect(third).toHaveAttribute("aria-pressed", "true");
    await testInfo.attach("REAL-reduced-motion-demo-" + viewport.name, {
      body: await page.screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });
    if (viewport.name === "mobile") {
      await page.evaluate(() => window.scrollTo(0, 0));
      const menu = page.getByRole("button", { name: "Open section menu" });
      await menu.click();
      const panel = page.getByRole("navigation", { name: "Mobile page sections" });
      await expect(panel).toBeVisible();
      await expect(panel).toHaveCSS("opacity", "1");
      await expect(panel).toHaveCSS("transform", "none");
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(menu).toBeFocused();
    }
  });

  for (const reducedMotion of ["reduce", "no-preference"] as const) {
    test(`first paint stays readable and actions wait for handlers ${viewport.name} ${reducedMotion}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion, colorScheme: "dark" });
      await page.addInitScript(() => localStorage.setItem("orire-consent", "denied"));
      let releaseScripts!: () => void;
      const scriptsReady = new Promise<void>((resolve) => { releaseScripts = resolve; });
      let heldRequests = 0;
      await page.route(/\/_next\/.*\.js(?:\?.*)?$/, async (route) => {
        heldRequests += 1;
        await scriptsReady;
        await route.continue();
      });
      try {
        await page.goto("/", { waitUntil: "commit" });
        const hero = page.locator(".landing-hero-inner");
        await expect(hero).toBeVisible();
        await expect(hero).toHaveCSS("opacity", "1");
        await expect(hero).toHaveCSS("transform", "none");
        await expect(hero).toHaveCSS("filter", "none");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const cta = page.getByRole("button", { name: /Create your CV/ }).first();
        await expect(cta).toBeDisabled();
        await expect.poll(() => heldRequests).toBeGreaterThan(0);
        if (viewport.name === "mobile") {
          await expect(page.getByRole("button", { name: "Open section menu" })).toBeDisabled();
        }
        await testInfo.attach(`REAL-first-paint-${viewport.name}-${reducedMotion}`, {
          body: await page.screenshot(), contentType: "image/png",
        });
        await page.getByRole("link", { name: "Explore templates", exact: true }).click();
        await expect(page).toHaveURL(/#templates$/);
      } finally {
        releaseScripts();
      }
      const cta = page.getByRole("button", { name: /Create your CV/ }).first();
      await expect(cta).toBeEnabled();
      if (viewport.name === "mobile") {
        const menu = page.getByRole("button", { name: "Open section menu" });
        await menu.click();
        const panel = page.getByRole("navigation", { name: "Mobile page sections" });
        await expect(panel).toBeVisible();
        await expect(page.getByRole("button", { name: "Close section menu" })).toHaveAttribute("aria-expanded", "true");
        await page.keyboard.press("Escape");
        await expect(panel).toHaveCount(0);
      }
      await cta.click();
      await expect(page.getByRole("dialog", { name: "Create your account" })).toBeVisible();
    });
  }
}
