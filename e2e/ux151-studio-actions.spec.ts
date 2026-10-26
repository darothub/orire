import { test, expect, signIn, waitForShell } from "./fixtures";

/** UX151 acceptance: real Studio actions must navigate, not just look clickable. */
for (const viewport of [
  { width: 1440, height: 900, name: "desktop" },
  { width: 390, height: 844, name: "mobile" },
]) {
  test("Studio start CV and library remain reachable " + viewport.name, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await signIn(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForShell(page);
    const home = page.getByRole("heading", { name: "Your CV studio" });
    await expect(home).toBeVisible();
    const next = page.locator(".spot-studio-next");
    await expect(next).toBeVisible();
    await testInfo.attach("STUDIO-implemented-" + viewport.name, {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
    await next.getByRole("button", { name: /Create your CV|Continue editing/ }).click();
    await expect(page.getByRole("heading", { name: "Edit", exact: true })).toBeVisible();
    const rail = page.getByRole("navigation", { name: "Workspaces" });
    // The Home brand button is intentionally hidden at <=820px; mobile users
    // return to Studio through the visible Add blocks entry in the rail.
    await rail.getByRole("button", {
      name: viewport.name === "mobile" ? "Add blocks" : "Home",
      exact: true,
    }).click();
    await expect(next).toBeVisible();
    await next.getByRole("button", { name: "Your library" }).click();
    await expect(page.getByRole("heading", { name: /Library|History|Your CVs/ })).toBeVisible();
  });
}
