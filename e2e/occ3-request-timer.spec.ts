import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3.4.4 elapsed timer isolation", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC access required");
  const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";

  test("request elapsed time advances without disturbing the draft and restarts at zero for a new request", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    await cookie.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "teacher-cv.txt", mimeType: "text/plain", buffer: Buffer.from(cv),
    });
    await page.getByRole("button", { name: "Send message" }).click();

    let started = () => {};
    const startedOnce = new Promise<void>(resolve => { started = resolve; });
    let releaseFirst = () => {};
    const heldFirst = new Promise<void>(resolve => { releaseFirst = resolve; });
    let releaseSecond = () => {};
    const heldSecond = new Promise<void>(resolve => { releaseSecond = resolve; });
    let calls = 0;
    await page.route("**/api/occ/general-review", async route => {
      calls++;
      if (calls === 1) {
        started();
        await heldFirst;
      } else {
        await heldSecond;
      }
      await route.fulfill({
        status: 503, contentType: "application/json",
        body: JSON.stringify({ error: "Unavailable" }),
      }).catch(() => {});
    });
    await page.getByRole("button", { name: "General review" }).click();
    await startedOnce;
    const elapsed = page.getByTestId("occ3-elapsed");
    await expect(elapsed).toHaveText("0s elapsed");
    await expect(elapsed).toHaveText(/^[1-9]\d*s elapsed$/, { timeout: 5000 });
    await expect(page.getByRole("button", { name: "Stop response" })).toBeVisible();
    await testInfo.attach("occ3-timer-mobile-390", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
    await page.getByRole("button", { name: "Stop response" }).click();
    await expect(elapsed).toHaveCount(0);
    const retry = page.getByRole("button", { name: "Retry review request" });
    await expect(retry).toBeVisible();
    await retry.click();
    await expect(elapsed).toHaveText("0s elapsed");
    releaseFirst();
    releaseSecond();
    await expect(page.getByRole("alert")).toContainText("Unavailable");
    expect(calls).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
