import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3.4 truthful processing feedback", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC-enabled gate only");
  const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";

  test("shows elapsed processing time, supports Stop, and leaves no stale timer", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    await cookie.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "teacher-cv.txt", mimeType: "text/plain", buffer: Buffer.from(cv),
    });
    await page.getByRole("button", { name: "Send message" }).click();

    let release = () => {};
    let started = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    const active = new Promise<void>(resolve => { started = resolve; });
    await page.route("**/api/occ/general-review", async route => {
      started();
      await gate;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        advice: { summary: "Late result", recommendations: [], nextSteps: [], disclaimer: "Verify claims." },
      }) }).catch(() => {});
    });
    await page.getByRole("button", { name: "General review" }).click();
    await active;
    const status = page.getByTestId("occ3-processing");
    await expect(status).toBeVisible();
    await expect(status).toContainText("Generating review");
    const elapsed = page.getByTestId("occ3-elapsed");
    await expect(elapsed).toHaveText(/^[0-9]+s elapsed$/);
    await expect(elapsed).not.toHaveText("0s elapsed", { timeout: 4000 });
    await testInfo.attach("occ3-progress-desktop-1440", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach("occ3-progress-mobile-390", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });

    await page.getByRole("button", { name: "Stop response" }).click();
    await expect(status).toHaveCount(0);
    await expect(page.getByRole("alert")).toContainText("Response stopped.");
    release();
    await expect(page.getByText("Late result")).toHaveCount(0);
    await page.getByRole("button", { name: /New chat/ }).click();
    await expect(page.getByTestId("occ3-elapsed")).toHaveCount(0);
    await expect(page.getByText("Start by attaching your CV using the paperclip below.")).toBeVisible();
  });
});
