import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3.4.3 mobile and keyboard usability", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC access required");

  test("Escape dismisses open menus and returns focus to their trigger", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    await cookie.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();

    const agent = page.getByRole("button", { name: "Select agent" });
    await agent.click();
    await expect(page.getByRole("listbox", { name: "OCC agents" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox", { name: "OCC agents" })).toHaveCount(0);
    await expect(agent).toBeFocused();

    const attach = page.getByRole("button", { name: "Attach document" });
    await attach.click();
    await expect(page.getByRole("group", { name: "Attach to conversation" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("group", { name: "Attach to conversation" })).toHaveCount(0);
    await expect(attach).toBeFocused();
  });

  test("mobile composer controls remain usable without horizontal overflow", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 760 });
      await page.goto("/occ/preview");
      await cookie.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
      if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();

      const composer = page.getByRole("form", { name: "OCC 3.0 composer" });
      for (const name of ["Attach document", "Select agent", "Send message"]) {
        const control = composer.getByRole("button", { name });
        await expect(control).toBeVisible();
        const bounds = await control.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.height).toBeGreaterThanOrEqual(40);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await composer.getByRole("button", { name: "Attach document" }).click();
      await expect(page.getByRole("group", { name: "Attach to conversation" })).toBeVisible();
      await testInfo.attach(`occ3-mobile-attachment-menu-${width}`, {
        body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
      });
      await page.keyboard.press("Escape");
      await composer.getByRole("button", { name: "Select agent" }).click();
      await testInfo.attach(`occ3-mobile-agent-menu-${width}`, {
        body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
      });
      await page.keyboard.press("Escape");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });
});
