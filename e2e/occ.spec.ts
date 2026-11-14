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

    await page.getByRole("button", { name: "Improve my CV" }).click();
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
    page.once("dialog", dialog => void dialog.accept());
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
    await expect(page.getByRole("region", { name: "Career Copilot conversation" })).toBeVisible();
    await testInfo.attach("occ-m7-overview-mobile", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
  test("M7 can reuse a saved CV without requiring pasted text", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const original = await db.document.create({ data: {
      userId: e2eUser.id, title: "Existing Master CV", data: JSON.parse(JSON.stringify(sampleCV)),
    } });
    await signIn(page);
    await page.goto("/occ");
    await page.getByRole("button", { name: "Review my CV for a role" }).click();
    await page.getByLabel("Select an existing Orire CV instead of pasting").selectOption(original.id);
    await expect(page.getByLabel("Your current CV text")).not.toBeEmpty();
    const stored = await db.document.findUniqueOrThrow({ where: { id: original.id } });
    expect(stored.data).toEqual(JSON.parse(JSON.stringify(sampleCV)));
  });

  test("M7 conversational entry reveals only relevant tools and keeps the CV draft", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.goto("/occ");
    await expect(page.getByRole("region", { name: "Career Copilot conversation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Review my CV for a role" })).toBeVisible();
    await expect(page.getByLabel("Your current CV text")).toHaveCount(0);
    await testInfo.attach("occ-m7-conversation-desktop", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
    await page.getByRole("button", { name: "Review my CV for a role" }).click();
    await expect(page.getByLabel("Your current CV text")).toBeVisible();
    await page.getByLabel("Your career goal (optional)").fill("Remote software engineering");
    await page.getByLabel("Your current CV text").fill("Experienced engineer creating secure distributed payment systems.");
    await page.getByLabel("Target job description").fill("Seeking engineer to design secure payment systems and services.");
    await page.getByLabel("Message your Career Copilot").fill("Manage my career memory");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("heading", { name: "Your career memory" })).toBeVisible();
    await page.getByLabel("Message your Career Copilot").fill("Review my CV for a role");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByLabel("Your current CV text")).toHaveValue("Experienced engineer creating secure distributed payment systems.");
    await expect(page.getByLabel("Your career goal (optional)")).toHaveValue("Remote software engineering");
    await expect(page.getByRole("region", { name: "Career Copilot conversation" }).getByText("OCC:", { exact: false }).first()).toBeVisible();
  });

  test("anonymous callers cannot access protected OCC endpoints", async ({ page }) => {
    expect((await page.request.get("/occ")).status()).toBe(404);
    expect((await page.request.get("/api/occ/profile")).status()).toBe(403);
    expect((await page.request.get("/api/occ/runs")).status()).toBe(403);
    expect((await page.request.post("/api/occ/advise", { data: {} })).status()).toBe(403);
  });

  test("undo refuses to remove an OCC version after it becomes active", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const source = await db.document.create({
      data: { userId: e2eUser.id, title: "Original", data: JSON.parse(JSON.stringify(sampleCV)) },
    });
    await db.user.update({ where: { id: e2eUser.id }, data: { activeDocumentId: source.id } });
    await signIn(page);
    const create = await page.request.post("/api/occ/versions", { data: {
      sourceId: source.id, expectedUpdatedAt: source.updatedAt.toISOString(),
      field: { kind: "summary" }, expectedText: sampleCV.basics.summary,
      replacement: sampleCV.basics.summary + " Confirmed wording updated by the user.",
    } });
    expect(create.status()).toBe(201);
    const { id, undoId } = await create.json();
    await db.user.update({ where: { id: e2eUser.id }, data: { activeDocumentId: id } });
    expect((await page.request.delete(`/api/occ/versions/${undoId}`)).status()).toBe(409);
    expect(await db.document.findUnique({ where: { id } })).not.toBeNull();
    expect(await db.document.findUnique({ where: { id: source.id } })).not.toBeNull();
  });

  test("undo refuses a version that was edited after creation", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const source = await db.document.create({
      data: { userId: e2eUser.id, title: "Original", data: JSON.parse(JSON.stringify(sampleCV)) },
    });
    await db.user.update({ where: { id: e2eUser.id }, data: { activeDocumentId: source.id } });
    await signIn(page);
    const create = await page.request.post("/api/occ/versions", { data: {
      sourceId: source.id, expectedUpdatedAt: source.updatedAt.toISOString(),
      field: { kind: "summary" }, expectedText: sampleCV.basics.summary,
      replacement: sampleCV.basics.summary + " User-approved change.",
    } });
    expect(create.status()).toBe(201);
    const { id, undoId } = await create.json();
    await db.document.update({ where: { id }, data: { title: "Edited after OCC saved" } });
    expect((await page.request.delete(`/api/occ/versions/${undoId}`)).status()).toBe(409);
    expect(await db.document.findUnique({ where: { id } })).not.toBeNull();
  });

});
