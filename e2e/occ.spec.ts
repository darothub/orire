import { test, expect, signIn } from "./fixtures";
import { sampleCV } from "../src/lib/cv/sample";

/** Executed twice in CI: baseline E2E with OCC off, and OCC-enabled gate suite. */
test("OCC is unavailable when the feature switch is off", async ({ page }) => {
  test.skip(process.env.ORIRE_OCC_ENABLED === "true", "Only meaningful with OCC disabled");
  await signIn(page);
  const access = await page.request.get("/api/occ/access");
  expect(access.ok()).toBeTruthy();
  expect((await access.json()).permitted).toBe(false);
  expect((await page.request.post("/api/occ/versions", { data: {} })).status()).toBe(403);
  expect((await page.request.get("/occ")).status()).toBe(404);
});

test.describe("Career-only OCC feature", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "Run with ORIRE_OCC_ENABLED=true");
  test("Career user can save an inactive private CV version and safely undo", async ({ page, db, e2eUser }, testInfo) => {
    const original = await db.document.create({
      data: { userId: e2eUser.id, title: "Sample Master CV", template: "aurora",
        data: JSON.parse(JSON.stringify(sampleCV)) },
    });
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await db.user.update({ where: { id: e2eUser.id }, data: { activeDocumentId: original.id } });
    await signIn(page);
    expect((await (await page.request.get("/api/occ/access")).json()).permitted).toBe(true);
    await page.goto("/occ");
    await expect(page.getByRole("heading", { name: "Your career, with a copilot." })).toBeVisible();

    await page.getByLabel("Source CV").selectOption(original.id);
    await page.getByLabel("Field to revise").selectOption("0");
    const before = await page.getByLabel("Before (original)").inputValue();
    expect(before.length).toBeGreaterThan(10);
    await page.getByLabel("After (your approved wording)").fill(before + " Additional truthful detail for review.");
    await testInfo.attach("occ-before-desktop", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
    await page.getByRole("button", { name: "Approve & save as new CV version" }).click();
    await expect(page.getByText("New private version saved to your CV Library.", { exact: false })).toBeVisible();

    const docs = await db.document.findMany({ where: { userId: e2eUser.id } });
    expect(docs).toHaveLength(2);
    const source = docs.find(d => d.id === original.id);
    const newDoc = docs.find(d => d.id !== original.id);
    expect(source?.data).toEqual(JSON.parse(JSON.stringify(sampleCV)));
    expect(newDoc?.shareToken).toBeNull();
    expect(newDoc?.template).toBe("aurora");
    const user = await db.user.findUniqueOrThrow({ where: { id: e2eUser.id } });
    expect(user.activeDocumentId).toBe(original.id);
    await page.getByRole("button", { name: "Undo saved version" }).click();

    await expect.poll(async () => db.document.count({ where: { userId: e2eUser.id } })).toBe(1);
    expect(await db.document.findUnique({ where: { id: original.id } })).not.toBeNull();
  });

  for (const plan of ["free", "pro"] as const) {
    test(`${plan} users cannot access OCC routes`, async ({ page, db, e2eUser }) => {
      await db.entitlement.create({ data: { userId: e2eUser.id, plan } });
      await signIn(page);
      expect((await (await page.request.get("/api/occ/access")).json()).permitted).toBe(false);
      expect((await page.request.get("/occ")).status()).toBe(404);
      expect((await page.request.get("/api/occ/profile")).status()).toBe(403);
      expect((await page.request.post("/api/occ/versions", { data: {} })).status()).toBe(403);
    });
  }

  test("another user's document cannot be versioned", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const other = await db.user.create({ data: { name: "Separate owner" } });
    try {
      const doc = await db.document.create({ data: {
        userId: other.id, title: "Other CV", data: JSON.parse(JSON.stringify(sampleCV)),
      } });
      await signIn(page);
      const res = await page.request.post("/api/occ/versions", { data: {
        sourceId: doc.id, expectedUpdatedAt: doc.updatedAt.toISOString(),
        field: { kind: "summary" }, expectedText: sampleCV.basics.summary,
        replacement: "Changed summary text without account access.",
      } });
      expect(res.status()).toBe(404);
      expect(await db.document.count({ where: { userId: e2eUser.id } })).toBe(0);
    } finally { await db.user.delete({ where: { id: other.id } }); }
  });

  test("changed source CV cannot be used to create an outdated revision", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const doc = await db.document.create({
      data: { userId: e2eUser.id, title: "Snapshot", data: JSON.parse(JSON.stringify(sampleCV)) },
    });
    const snapshotTime = doc.updatedAt.toISOString();
    await db.document.update({ where: { id: doc.id }, data: { title: "Edited after snapshot" } });
    await signIn(page);
    const res = await page.request.post("/api/occ/versions", { data: {
      sourceId: doc.id, expectedUpdatedAt: snapshotTime,
      field: { kind: "summary" }, expectedText: sampleCV.basics.summary,
      replacement: "Updated and clarified professional summary.",
    } });
    expect(res.status()).toBe(409);
    expect(await db.document.count({ where: { userId: e2eUser.id } })).toBe(1);
  });

  test("OCC layout has no horizontal overflow at mobile width", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/occ");
    await expect(page.getByRole("heading", { name: "Your career, with a copilot." })).toBeVisible();
    await testInfo.attach("occ-mobile", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
