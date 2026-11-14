import { test, expect, signIn } from "./fixtures";
import { sampleCV } from "../src/lib/cv/sample";
import { Document, Packer, Paragraph } from "docx";

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
    await page.getByLabel("Select your CV").selectOption(original.id);
    await expect(page.getByText("Using your selected Orire CV.", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Your current CV text")).toHaveCount(0);
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
    await page.getByLabel("Your current CV text").fill("Experienced engineer creating secure distributed payment systems.");
    await page.getByLabel("Target job description").fill("Seeking engineer to design secure payment systems and services.");
    await page.getByLabel("Message your Career Copilot").fill("Manage my career memory");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("heading", { name: "Your career memory" })).toBeVisible();
    await page.getByLabel("Message your Career Copilot").fill("Review my CV for a role");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByLabel("Your current CV text")).toHaveValue("Experienced engineer creating secure distributed payment systems.");
    await expect(page.getByRole("region", { name: "Career Copilot conversation" }).getByText("OCC:", { exact: false }).first()).toBeVisible();
  });

  test("M7 orchestrator asks for the missing job description and accepts a follow-up", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await db.document.create({ data: {
      userId: e2eUser.id, title: "My Career CV", data: JSON.parse(JSON.stringify(sampleCV)),
    } });
    await signIn(page);
    await page.goto("/occ");
    await page.getByRole("button", { name: "Review my CV for a role" }).click();
    await expect(page.getByText("First select a CV from your Orire library", { exact: false })).toBeVisible();
    await page.getByLabel("Select your CV").selectOption({ label: "My Career CV" });
    await page.getByLabel("Message your Career Copilot").fill("Review my CV for a role");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Your CV is ready. Please provide the target job description", { exact: false })).toBeVisible();
    const jd = "We are looking for a senior engineer with experience with payment platforms, responsible for API architecture, authentication, quality testing and reliable services.";
    await page.getByLabel("Message your Career Copilot").fill(jd);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByLabel("Target job description")).toHaveValue(jd);
    await expect(page.getByRole("button", { name: "Review my fit" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Run keyword check" })).toHaveCount(0);
    await testInfo.attach("occ-m7-orchestrated-context", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
  });

  test("M7 compact suggestions and one primary AI review action", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.goto("/occ");
    // The compact controls retain their existing accessible names.
    await expect(page.getByRole("button", { name: "Review my CV for a role" })).toBeVisible();
    const height = await page.getByRole("button", { name: "Review my CV for a role" }).evaluate(el => el.getBoundingClientRect().height);
    expect(height).toBeLessThan(55);
    await page.getByRole("button", { name: "Review my CV for a role" }).click();
    await expect(page.getByRole("heading", { name: "Review your fit for this role" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Review my fit" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Ask OCC for recommendations" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Compare CV with role" })).toHaveCount(0);
    await page.getByRole("button", { name: "Other option: keyword-only check (no AI)" }).click();
    await expect(page.getByRole("button", { name: "Run keyword check" })).toBeVisible();
    await testInfo.attach("occ-m7-compact-action-desktop", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
  });

  test("M7 supports CV and job-description files from the conversation start", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.goto("/occ");
    await expect(page.getByLabel("Upload CV", { exact: true })).toHaveCount(1);
    await expect(page.getByLabel("Upload job description", { exact: true })).toHaveCount(1);
    await page.getByLabel("Upload CV", { exact: true }).setInputFiles({
      name: "career.txt", mimeType: "text/plain",
      buffer: Buffer.from("Senior software engineer building reliable payment and authentication services. Experienced with Java, Kotlin and API integration."),
    });
    await expect(page.getByText("CV attached: career.txt", { exact: false })).toBeVisible();
    await page.getByLabel("Upload job description", { exact: true }).setInputFiles({
      name: "position.txt", mimeType: "text/plain",
      buffer: Buffer.from("We are looking for an engineer who designs payment systems, Java services and secure authentication APIs for distributed platforms."),
    });
    await expect(page.getByLabel("Your current CV text")).toHaveValue(/Senior software engineer/);
    await expect(page.getByLabel("Target job description")).toHaveValue(/We are looking for an engineer/);
    await expect(page.getByRole("button", { name: "Review my fit" })).toBeEnabled();
    expect(await db.document.count({ where: { userId: e2eUser.id } })).toBe(0);
    await testInfo.attach("occ-m7-uploads-desktop", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
  });

  test("M7 retains document upload after choosing a suggested prompt on mobile", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/occ");
    await page.getByRole("button", { name: "Review my CV for a role" }).click();
    await expect(page.getByLabel("Upload another CV")).toBeVisible();
    await expect(page.getByLabel("Upload role description")).toBeVisible();
    await page.getByLabel("Upload another CV").setInputFiles({
      name: "updated-cv.txt", mimeType: "text/plain",
      buffer: Buffer.from("Experienced backend software engineer working on secure Java payment APIs, authentication and automated testing."),
    });
    await expect(page.getByText("CV: updated-cv.txt", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Your current CV text")).toHaveValue(/Experienced backend software engineer/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await testInfo.attach("occ-m7-uploads-mobile", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
  });

  test("M7 reads a DOCX through the existing authenticated Orire parser", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await db.user.update({ where: { id: e2eUser.id }, data: { emailVerified: new Date() } });
    await signIn(page);
    await page.goto("/occ");
    const doc = new Document({ sections: [{
      children: [new Paragraph("Senior engineer creating reliable Java and Kotlin payment services, with authentication and integration testing expertise.")],
    }] });
    await page.getByLabel("Upload CV", { exact: true }).setInputFiles({
      name: "career.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: await Packer.toBuffer(doc),
    });
    await expect(page.getByText("CV attached: career.docx", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Your current CV text")).toHaveValue(/Senior engineer creating reliable Java/);
    expect(await db.document.count({ where: { userId: e2eUser.id } })).toBe(0);
  });

  test("M7 rejects unsupported and empty uploads without setting analysis context", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.goto("/occ");
    await page.getByLabel("Upload CV", { exact: true }).setInputFiles({
      name: "invalid.exe", mimeType: "application/octet-stream", buffer: Buffer.from("fake"),
    });
    await expect(page.getByRole("region", { name: "Career Copilot conversation" }).getByRole("alert")).toContainText("Upload a PDF, DOCX or TXT document");
    await page.getByLabel("Upload CV", { exact: true }).setInputFiles({
      name: "empty.txt", mimeType: "text/plain", buffer: Buffer.from(""),
    });
    await expect(page.getByRole("region", { name: "Career Copilot conversation" }).getByRole("alert")).toContainText("TXT files must be under 1 MB");
    await expect(page.getByLabel("Your current CV text")).toHaveCount(0);
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
