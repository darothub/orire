import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3.3.3 document parsing isolation", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC-enabled gate only");

  const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";

  test("new chat cancels an in-flight PDF parse and old response cannot attach to the new conversation", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    await cookie.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();

    let releaseParse: (() => void) | undefined;
    let acknowledgeParse: (() => void) | undefined;
    const started = new Promise<void>(resolve => { acknowledgeParse = resolve; });
    const blocked = new Promise<void>(resolve => { releaseParse = resolve; });
    await page.route("**/api/parse", async route => {
      acknowledgeParse?.();
      await blocked;
      // Browser may already have aborted this request after New chat.
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ files: [{ text: cv }] }),
      }).catch(() => {});
    });
    await page.locator('input[type="file"]').setInputFiles({
      name: "stale-cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 simulated upload"),
    });
    await started;
    await expect(page.getByTestId("occ3-processing")).toBeVisible();
    await page.getByRole("button", { name: /New chat/ }).click();
    releaseParse?.();

    await expect(page.getByRole("region", { name: "OCC 3.0 conversation" })).toContainText("Start by attaching your CV");
    await expect(page.getByTestId("occ3-processing")).toHaveCount(0);
    await expect(page.getByText("stale-cv.pdf")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "General review" })).toHaveCount(0);
    await testInfo.attach("occ3-parse-reset-desktop-1440", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });

    await page.locator('input[type="file"]').setInputFiles({
      name: "fresh-cv.txt", mimeType: "text/plain", buffer: Buffer.from(cv),
    });
    await expect(page.getByText("fresh-cv.txt")).toBeVisible();
    await expect(page.getByText("stale-cv.pdf")).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach("occ3-parse-recovery-mobile-390", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
  });
});
