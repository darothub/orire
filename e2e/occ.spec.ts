import { test, expect, signIn } from "./fixtures";
import { sampleCV } from "../src/lib/cv/sample";
import { addSessionCookie } from "./session";
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
  test("OCC 2.0 agent picker and document paste stay in the same conversation", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.goto("/occ");
    await expect(page.getByRole("navigation", { name: "Career Copilot specialists" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Current conversation documents and milestones" })).toBeVisible();
    const agent = page.getByLabel("Agent", { exact: true });
    await expect(agent).toHaveValue("review");
    await page.getByRole("button", { name: "Paste CV" }).click();
    await page.getByLabel("Paste full CV").fill("Experienced senior engineer specializing in Java microservices, database transactions, reliable distributed systems and integration testing.");
    await page.getByRole("button", { name: "Paste JD" }).click();
    await page.getByLabel("Paste full job description").fill("We need an engineer responsible for designing Java APIs, secure payments and production microservices with integration testing.");
    await expect(page.getByText("✓ CV ready", { exact: false })).toBeVisible();
    await agent.selectOption("interview");
    await expect(page.getByRole("region", { name: "Mock interview workspace" })).toBeVisible();
    await agent.selectOption("review");
    await expect(page.getByLabel("Paste full CV")).toHaveValue(/Experienced senior engineer/);
    await expect(page.getByLabel("Paste full job description")).toHaveValue(/We need an engineer/);
    await expect(page.getByRole("navigation", { name: "Conversation milestones" }).getByRole("button").first()).toBeVisible();
    await testInfo.attach("occ2-desktop-conversation-rails", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
  });

  test("OCC 2.0 mobile exposes session and context rails on demand", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/occ");
    await page.getByRole("button", { name: "☰ Sessions" }).click();
    await expect(page.getByRole("complementary", { name: "Career Copilot conversations" })).toBeVisible();
    await page.getByRole("button", { name: "Documents & milestones" }).click();
    await expect(page.getByRole("complementary", { name: "Current conversation documents and milestones" })).toBeVisible();
    await testInfo.attach("occ2-mobile-context-rails", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      offenders: Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter(element => element.getBoundingClientRect().right > window.innerWidth + 2 &&
          getComputedStyle(element).display !== "none")
        .slice(0, 8).map(element => ({ tag: element.tagName, className: String(element.className).slice(0, 90), width: Math.ceil(element.getBoundingClientRect().width) })),
    }));
    expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewportWidth);
  });

  test("OCC 2.0 explicitly saved transcript can be reopened and deleted without storing CV/JD", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.goto("/occ");
    await page.getByRole("button", { name: "Review my CV for a role" }).click();
    await page.getByRole("button", { name: "Paste CV" }).click();
    await page.getByLabel("Paste full CV").fill("Senior engineer experienced in secure Java payment microservices and integration testing.");
    await page.getByRole("button", { name: "Paste JD" }).click();
    await page.getByLabel("Paste full job description").fill("Senior backend engineer needed to build Java microservices and secure payment APIs.");
    await page.getByRole("button", { name: "Save transcript privately" }).click();
    await expect(page.getByText("Transcript saved privately.", { exact: false })).toBeVisible();
    await testInfo.attach("occ2-private-session-history-desktop", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
    const sessions = await db.occConversation.findMany({
      where: { userId: e2eUser.id }, include: { messages: true },
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].messages.length).toBeGreaterThan(0);
    expect(JSON.stringify(sessions[0])).not.toContain("Senior engineer experienced");
    expect(JSON.stringify(sessions[0])).not.toContain("Senior backend engineer needed");
    page.once("dialog", dialog => void dialog.accept());
    await page.getByRole("button", { name: "＋ New conversation" }).click();
    await expect(page.getByLabel("Paste full CV")).toHaveCount(0);
    const history = page.getByRole("region", { name: "CV Review sessions" });
    await expect(history.getByRole("button").first()).toBeVisible();
    await history.getByRole("button").first().click();
    await expect(page.getByText("Conversation restored. Reattach", { exact: false })).toBeVisible();
    expect((await db.occConversation.count({ where: { userId: e2eUser.id } }))).toBe(1);
    page.once("dialog", dialog => void dialog.accept());
    await history.getByRole("button", { name: /Delete conversation:/ }).click();
    await expect.poll(() => db.occConversation.count({ where: { userId: e2eUser.id } })).toBe(0);
    await expect.poll(() => db.occMessage.count({ where: { conversationId: sessions[0].id } })).toBe(0);
  });

  test("OCC transcript API rejects another Career user's conversation", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const other = await db.user.create({ data: { name: "Isolated other user" } });
    try {
      const conversation = await db.occConversation.create({
        data: { userId: other.id, title: "Private notes", messages: { create: { sequence: 0, sender: "you", text: "Confidential test" } } },
      });
      await signIn(page);
      expect((await page.request.get("/api/occ/conversations/" + conversation.id)).status()).toBe(404);
      expect((await page.request.delete("/api/occ/conversations/" + conversation.id)).status()).toBe(404);
      const attack = await page.request.post("/api/occ/conversations", { data: {
        id: conversation.id, title: "Overwrite", primaryAgent: "review",
        usedAgents: ["review"], turns: [{ role: "you", text: "Overwrite attempted" }],
      } });
      expect(attack.status()).toBe(404);
      const unchanged = await db.occMessage.findFirst({ where: { conversationId: conversation.id } });
      expect(unchanged?.text).toBe("Confidential test");
    } finally {
      await db.user.delete({ where: { id: other.id } });
    }
  });

  test("OCC 2.0 previews a saved CV with the real template renderer without modifying its document", async ({ page, db, e2eUser }, testInfo) => {
    const saved = await db.document.create({ data: {
      userId: e2eUser.id, title: "Preview CV", template: "aurora",
      data: JSON.parse(JSON.stringify(sampleCV)),
    } });
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.goto("/occ");
    await page.getByLabel("Use saved Orire CV").selectOption(saved.id);
    await expect(page.getByRole("region", { name: "CV template preview" })).toBeVisible();
    const previewSelector = page.getByLabel("Preview template");
    await expect(previewSelector).toHaveValue("aurora");
    await previewSelector.selectOption("noir");
    await page.getByRole("button", { name: "Open full CV preview" }).click();
    const dialog = page.getByRole("dialog", { name: "Preview Preview CV" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(sampleCV.basics.fullName, { exact: false }).first()).toBeVisible();
    await testInfo.attach("occ2-real-noir-template-preview", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
    await dialog.getByRole("button", { name: "Close CV template preview" }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Documents & milestones" }).click();
    await page.getByRole("button", { name: "Open full CV preview" }).click();
    await expect(dialog).toBeVisible();
    await testInfo.attach("occ2-real-noir-template-preview-mobile", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
    await dialog.getByRole("button", { name: "Close CV template preview" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const unchanged = await db.document.findUniqueOrThrow({ where: { id: saved.id } });
    expect(unchanged.template).toBe("aurora");
    expect(unchanged.data).toEqual(JSON.parse(JSON.stringify(sampleCV)));
    await page.getByRole("region", { name: "Current CV attachment" }).getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("button", { name: "Open full CV preview" })).toHaveCount(0);
    await expect(page.getByText("Choose a saved Orire CV to preview it", { exact: false })).toBeVisible();
    expect((await db.document.count({ where: { userId: e2eUser.id } }))).toBe(1);
  });

  test("OCC document context lets users edit and remove pasted job descriptions", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.goto("/occ");
    await page.getByRole("button", { name: "Paste JD" }).click();
    await page.getByLabel("Paste full job description").fill(
      "We need a backend engineer to design secure Java services, integrate payment APIs and lead production testing."
    );
    const context = page.getByRole("region", { name: "Current job-description attachment" });
    await expect(context.getByText("Pasted role description")).toBeVisible();
    await context.getByRole("button", { name: "View / edit" }).click();
    await expect(page.getByLabel("Paste full job description")).toBeVisible();
    await context.getByRole("button", { name: "Remove" }).click();
    await expect(context.getByText("Not attached")).toBeVisible();
    await expect(page.getByLabel("Paste full job description")).toHaveCount(0);
  });

  test("OCC guarded rewrite is editable, requires confirmation, and supports reject and local undo", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    const evidence = "Built Kotlin services and tested payment APIs.";
    await page.route("**/api/occ/advise", async route => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        advice: {
          summary: "Evidence-based synthetic review.",
          recommendations: [{ requirement: "Kotlin services", cvEvidence: evidence, assessment: "supported",
            suggestion: "Emphasize supported work without inventing metrics.",
            sampleWording: "Tested payment APIs and built Kotlin services.", question: null }],
          nextSteps: [], disclaimer: "Review all proposed wording."
        }, usedSavedProfile: false, runId: null,
      }) });
    });
    await page.goto("/occ");
    await page.getByRole("button", { name: "Review my CV for a role" }).click();
    await page.getByLabel("Your current CV text").fill("Summary: Experienced engineer. " + evidence);
    await page.getByLabel("Target job description").fill("We are looking for an engineer responsible for Kotlin services and payment APIs.");
    await page.getByRole("button", { name: "Review my fit" }).click();
    await page.getByText("Review and approve suggested CV wording").click();
    const area = page.getByRole("heading", { name: "Review CV wording changes" }).locator("..");
    await area.getByLabel("CV passage to review").selectOption("0");
    await expect(area.getByLabel("OCC suggested CV rewrite")).toContainText("Tested payment APIs");
    await expect(area.getByRole("button", { name: "Approve wording in local draft" })).toBeDisabled();
    await testInfo.attach("occ2-evidence-grounded-rewrite-before", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
    await area.getByRole("checkbox").check();
    await area.getByRole("button", { name: "Approve wording in local draft" }).click();
    await expect(area.getByLabel("Working draft (not saved to Orire)")).toHaveValue(/Tested payment APIs and built Kotlin services/);
    await area.getByRole("button", { name: "Undo last local change" }).click();
    await expect(area.getByLabel("Working draft (not saved to Orire)")).toHaveValue("Summary: Experienced engineer. " + evidence);
    await area.getByLabel("CV passage to review").selectOption("0");
    await area.getByRole("button", { name: "Reject this suggestion" }).click();
    await expect(area.getByText("Suggested wording rejected.", { exact: false })).toBeVisible();
    expect(await db.document.count({ where: { userId: e2eUser.id } })).toBe(0);
  });

  test("OCC 2.0 review cards and composer remain in the same conversation", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.route("**/api/occ/advise", route => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify({
        advice: { summary: "Synthetic grounded role review.",
          recommendations: [{ requirement: "Payment systems", cvEvidence: "Built secure Java services", assessment: "supported",
            suggestion: "Describe the work you performed.", sampleWording: null, question: null }],
          nextSteps: ["Confirm that all wording is accurate."], disclaimer: "Test fixture only." },
        usedSavedProfile: false, runId: null,
      }),
    }));
    await page.goto("/occ");
    const conversation = page.getByRole("region", { name: "Career Copilot conversation" });
    await conversation.getByRole("button", { name: "Review my CV for a role" }).click();
    await conversation.getByLabel("Your current CV text").fill("Senior engineer. Built secure Java services integrating payment platforms and APIs.");
    await conversation.getByLabel("Target job description").fill("Hiring an engineer to design reliable secure Java APIs and financial payment services.");
    await conversation.getByRole("button", { name: "Review my fit" }).click();
    await expect(conversation.getByRole("region", { name: "OCC recommendations workspace" })).toBeVisible();
    await expect(conversation.getByText("Synthetic grounded role review.")).toBeVisible();
    await expect(conversation.getByRole("button", { name: "Review my fit" })).toHaveCount(0);
    await expect(conversation.getByText("Review findings")).toBeVisible();
    const findings = conversation.getByRole("region", { name: "OCC recommendations workspace" });
    await findings.locator("details").first().locator("summary").click();
    await expect(findings.getByText("Built secure Java services", { exact: true })).toBeVisible();
    await expect(conversation.getByRole("textbox", { name: "Message your Career Copilot" })).toBeVisible();
    await expect(conversation.getByRole("button", { name: "↓ Jump to latest" })).toBeVisible();
    await testInfo.attach("occ2-unified-review-desktop", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(conversation.getByRole("region", { name: "OCC recommendations workspace" })).toBeVisible();
    await testInfo.attach("occ2-unified-review-mobile", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("OCC 2.0 preserves an active interview while navigating between agents, but resets on new session", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.route("**/api/occ/interview", route => route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ question: {
        question: "How would you explain a complex technical decision to your team?",
        focus: "Communication",
        answerStarters: ["Describe your own example.", "Explain your reasoning."],
      }, turnIndex: 0 }),
    }));
    await page.goto("/occ");
    await page.getByRole("button", { name: "Prepare for an interview" }).click();
    const conversation = page.getByRole("region", { name: "Career Copilot conversation" });
    await expect(conversation.getByRole("region", { name: "Mock interview workspace" })).toBeVisible();
    await conversation.getByRole("button", { name: "Paste JD" }).click();
    await conversation.getByLabel("Paste full job description").fill(
      "Hiring a software engineer to design APIs, explain technical decisions and collaborate with teams.");
    await conversation.getByRole("button", { name: "Start mock interview" }).click();
    const prompt = "How would you explain a complex technical decision to your team?";
    await expect(conversation.getByRole("heading", { name: prompt })).toBeVisible();
    await conversation.getByRole("textbox", { name: "Message your Career Copilot" }).fill("I would explain the tradeoffs with a concrete example and ask the team for feedback.");
    await conversation.getByLabel("Agent", { exact: true }).selectOption("review");
    await expect(conversation.getByRole("region", { name: "Mock interview workspace" })).toHaveCount(0);
    await conversation.getByLabel("Agent", { exact: true }).selectOption("interview");
    await expect(conversation.getByRole("heading", { name: prompt })).toBeVisible();
    await expect(conversation.getByRole("textbox", { name: "Message your Career Copilot" })).toHaveValue(/tradeoffs with a concrete example/);
    page.once("dialog", dialog => void dialog.accept());
    await page.getByRole("button", { name: "＋ New conversation" }).click();
    await conversation.getByLabel("Agent", { exact: true }).selectOption("interview");
    await expect(conversation.getByRole("button", { name: "Start mock interview" })).toBeDisabled();
  });

  test("P7A composer runs a review only after explicit action and displays it in the assistant timeline", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    let aiCalls = 0;
    await page.route("**/api/occ/advise", route => {
      aiCalls++;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        advice: { summary: "Synthetic, evidence-based role review.",
          recommendations: [{
            requirement: "Secure Java services", assessment: "supported",
            cvEvidence: "Built secure Java services", suggestion: "Emphasize the documented work.",
            sampleWording: null, question: null,
          }],
          nextSteps: ["Check each detail."], disclaimer: "Synthetic review; verify all claims." },
        usedSavedProfile: false, runId: null,
      }) });
    });
    await page.goto("/occ");
    const conversation = page.getByRole("region", { name: "Career Copilot conversation" });
    await conversation.getByRole("button", { name: "Paste CV" }).click();
    await conversation.getByLabel("Paste full CV").fill("Backend engineer. Built secure Java services for a payment platform.");
    await conversation.getByRole("button", { name: "Paste JD" }).click();
    await conversation.getByLabel("Paste full job description").fill("Hiring an engineer to design and operate reliable secure Java payment services.");
    expect(aiCalls).toBe(0);
    await expect(conversation.getByRole("button", { name: "Review attached CV" })).toBeVisible();
    await conversation.getByRole("button", { name: "Review attached CV" }).click();
    await expect(conversation.getByRole("region", { name: "OCC recommendations workspace" })).toBeVisible();
    await expect(conversation.getByText("Synthetic, evidence-based role review.")).toBeVisible();
    expect(aiCalls).toBe(1);
    await conversation.getByRole("textbox", { name: "Message your Career Copilot" }).fill("Could you clarify what I should verify?");
    await conversation.getByRole("textbox", { name: "Message your Career Copilot" }).press("Enter");
    await expect(conversation.getByText("Could you clarify what I should verify?", { exact: false })).toBeVisible();
    await expect(conversation.getByRole("region", { name: "OCC recommendations workspace" })).toBeVisible();
    await testInfo.attach("occ2-p7a-chat-review-desktop", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await testInfo.attach("occ2-p7a-chat-review-mobile", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

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
    await expect(page.getByRole("heading", { name: "Where should we take your career?" })).toBeVisible();

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

  test("Career account with a non-allowlisted email is denied", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    // Change the signed-in identity's claimed email: it no longer matches
    // either the exact beta allowlist or the tightly scoped E2E fixture.
    await addSessionCookie(page.context(), { ...e2eUser, email: "not-allowed@example.com" });
    expect((await (await page.request.get("/api/occ/access")).json()).permitted).toBe(false);
    expect((await page.request.get("/api/occ/profile")).status()).toBe(403);
    expect((await page.request.get("/occ")).status()).toBe(404);
  });

  test("allowlisted Career account can access OCC", async ({ page, db, e2eUser }) => {
    const betaEmail = "occ-beta-ci@orire.test";
    test.skip(process.env.ORIRE_OCC_BETA_EMAILS !== betaEmail, "Requires hermetic CI beta allowlist");
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await db.user.update({ where: { id: e2eUser.id }, data: { email: betaEmail } });
    await addSessionCookie(page.context(), { ...e2eUser, email: betaEmail });
    const access = await page.request.get("/api/occ/access");
    expect(access.status()).toBe(200);
    expect((await access.json()).permitted).toBe(true);
    await page.goto("/occ");
    await expect(page.getByRole("heading", { name: "Where should we take your career?" })).toBeVisible();
  });

  test("signed beta email with mismatched database identity is denied", async ({ page, db, e2eUser }) => {
    const betaEmail = "occ-beta-ci@orire.test";
    test.skip(process.env.ORIRE_OCC_BETA_EMAILS !== betaEmail, "Requires hermetic CI beta allowlist");
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    // Do not update DB: the JWT's email differs from the canonical account.
    await addSessionCookie(page.context(), { ...e2eUser, email: betaEmail });
    expect((await (await page.request.get("/api/occ/access")).json()).permitted).toBe(false);
    expect((await page.request.get("/api/occ/profile")).status()).toBe(403);
    expect((await page.request.get("/occ")).status()).toBe(404);
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
    await expect(page.getByRole("heading", { name: "Where should we take your career?" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Career Copilot conversation" })).toBeVisible();
    const decline = page.getByRole("button", { name: "Decline", exact: true });
    if (await decline.isVisible()) await decline.click();
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
    const decline = page.getByRole("button", { name: "Decline", exact: true });
    if (await decline.isVisible()) await decline.click();
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
    await expect(page.getByRole("region", { name: "Career Copilot conversation" }).getByText("First select a CV from your Orire library", { exact: false })).toBeVisible();
    await page.getByLabel("Select your CV").selectOption({ label: "My Career CV" });
    await page.getByLabel("Message your Career Copilot").fill("Review my CV for a role");
    // The fixed consent banner overlaps the now-sticky composer until the user
    // makes a choice. Exercise the real Decline control instead of forcing clicks.
    const cookieBanner = page.getByRole("dialog", { name: "Cookie consent" });
    await cookieBanner.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
    if (await cookieBanner.isVisible()) {
      await cookieBanner.getByRole("button", { name: "Decline" }).click();
    }
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("region", { name: "Career Copilot conversation" }).getByText("Your CV is ready. Please provide the target job description", { exact: false })).toBeVisible();
    const jd = "We are looking for a senior engineer with experience with payment platforms, responsible for API architecture, authentication, quality testing and reliable services.";
    await page.getByLabel("Message your Career Copilot").fill(jd);
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByLabel("Target job description")).toHaveValue(jd);
    await expect(page.getByRole("button", { name: "Review my fit" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Run keyword check" })).toHaveCount(0);
    await testInfo.attach("occ-m7-orchestrated-context", { body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png" });
  });

  test("M7.1 contextual review shows readiness and keeps uploaded texts collapsed", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.goto("/occ");
    await page.getByLabel("Upload CV", { exact: true }).setInputFiles({
      name: "resume.txt", mimeType: "text/plain",
      buffer: Buffer.from("Senior software engineer building secure APIs and distributed payment systems. Experienced with Kotlin and Java integration testing."),
    });
    await expect(page.getByText("1. Your CV")).toBeVisible();
    await expect(page.getByText("✓ Ready to review")).toBeVisible();
    await expect(page.getByRole("button", { name: "View or edit extracted CV text" })).toBeVisible();
    await expect(page.getByLabel("Your current CV text")).toHaveCount(0);
    await page.getByLabel("Upload job description", { exact: true }).setInputFiles({
      name: "role.txt", mimeType: "text/plain",
      buffer: Buffer.from("We are looking for an engineer responsible for payment API architecture, secure authentication, distributed services and automated testing."),
    });
    await expect(page.getByText("✓ Requirements added")).toBeVisible();
    await expect(page.getByLabel("Target job description")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Review my fit" })).toBeEnabled();
    const decline = page.getByRole("button", { name: "Decline", exact: true });
    if (await decline.isVisible()) await decline.click();
    await testInfo.attach("occ-m7-1-desktop-upload-ready", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
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
    const composer = page.getByRole("region", { name: "Career Copilot conversation" }).getByRole("textbox", { name: "Message your Career Copilot" }).locator("..");
    await expect(composer.getByLabel("Upload CV", { exact: true })).toBeVisible();
    await expect(composer.getByLabel("Upload job description", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Upload job description", { exact: true })).toHaveCount(1);
    await page.getByLabel("Upload CV", { exact: true }).setInputFiles({
      name: "career.txt", mimeType: "text/plain",
      buffer: Buffer.from("Senior software engineer building reliable payment and authentication services. Experienced with Java, Kotlin and API integration."),
    });
    await expect(page.getByRole("status", { name: "Attached career documents" })).toContainText("CV ready · career.txt");
    await page.getByLabel("Upload job description", { exact: true }).setInputFiles({
      name: "position.txt", mimeType: "text/plain",
      buffer: Buffer.from("We are looking for an engineer who designs payment systems, Java services and secure authentication APIs for distributed platforms."),
    });
    await expect(page.getByRole("button", { name: "View or edit extracted CV text" })).toBeVisible();
    await page.getByRole("button", { name: "View or edit extracted CV text" }).click();
    await expect(page.getByLabel("Your current CV text")).toHaveValue(/Senior software engineer/);
    await expect(page.getByRole("button", { name: "View or edit job description" })).toBeVisible();
    await page.getByRole("button", { name: "View or edit job description" }).click();
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
    await page.getByRole("button", { name: "View or edit extracted CV text" }).click();
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
    await expect(page.getByRole("status", { name: "Attached career documents" })).toContainText("CV ready · career.docx");
    await page.getByRole("button", { name: "View or edit extracted CV text" }).click();
    await expect(page.getByLabel("Your current CV text")).toHaveValue(/Senior engineer creating reliable Java/);
    expect(await db.document.count({ where: { userId: e2eUser.id } })).toBe(0);
  });

  test("M7 rejects a non-CV document even when it is a supported TXT upload", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.goto("/occ");
    await page.getByLabel("Upload CV", { exact: true }).setInputFiles({
      name: "business-report.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("The quarterly business report details revenue and growth patterns. Costs and expenses are expected to decline next year."),
    });
    await expect(page.getByRole("region", { name: "Career Copilot conversation" }).getByRole("alert")).toContainText("This document does not appear to be a CV");
    await expect(page.getByText("CV attached: business-report.txt")).toHaveCount(0);
    await expect(page.getByLabel("Your current CV text")).toHaveCount(0);
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

  test("M8 guided mock interview waits for target role and returns answer feedback", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    let calls = 0;
    await page.route("**/api/occ/interview", async route => {
      calls++;
      const body = route.request().postDataJSON() as { mode: string; turnIndex: number };
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify(body.mode === "question"
          ? { question: { question: "How would you prevent duplicate payments in a distributed system?", focus: "Payment system reliability", answerStarters: ["I would discuss a safe way to handle repeated requests, then describe a real example.", "I would explain how I would check for duplicates and test that approach."] }, turnIndex: body.turnIndex }
          : { feedback: {
              strength: "You explained idempotency clearly.",
              improvement: "Mention retry ownership and observability.",
              example: "Illustrative outline: idempotency key, dedupe store, alerts.",
              followUp: "How would you verify retries are safe?",
              betterWording: "I would add idempotency keys and a shared dedupe store. Then I would test retry behavior across service boundaries.",
              whyBetter: "It explains your plan in an order that is easier to follow.",
            }, turnIndex: body.turnIndex }),
      });
    });
    await page.goto("/occ");
    await page.getByRole("button", { name: "Prepare for an interview" }).click();
    await expect(page.getByRole("region", { name: "Mock interview workspace" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start mock interview" })).toBeDisabled();
    expect(calls).toBe(0);
    await page.getByRole("button", { name: "Paste JD" }).click();
    await page.getByLabel("Paste full job description").fill("Seeking an engineer to design and operate secure distributed payment systems and APIs for financial transactions.");
    await expect(page.getByRole("button", { name: "Start mock interview" })).toBeEnabled();
    await page.getByRole("button", { name: "Start mock interview" }).click();
    await expect(page.getByRole("heading", { name: "How would you prevent duplicate payments in a distributed system?" })).toBeVisible();
    await page.getByRole("button", { name: "See 2 answer starters" }).click();
    await expect(page.getByLabel("Answer ideas")).toContainText("Idea 1:");
    await expect(page.getByLabel("Answer ideas")).toContainText("Idea 2:");
    await testInfo.attach("occ-m8-answer-ideas-desktop", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
    await expect(page.getByRole("button", { name: "Get feedback" })).toBeDisabled();
    await page.getByRole("textbox", { name: "Message your Career Copilot" }).fill("I would add idempotency keys and a shared dedupe store, then test retry behavior across service boundaries.");
    await page.getByRole("button", { name: "Get feedback" }).click();
    await expect(page.getByText("You explained idempotency clearly.")).toBeVisible();
    await page.getByText("Suggested clearer wording").click();
    await expect(page.getByText("I would add idempotency keys and a shared dedupe store.", { exact: false })).toBeVisible();
    await expect(page.getByText("It explains your plan in an order that is easier to follow.")).toBeVisible();
    await page.getByRole("button", { name: "Edit this wording in composer" }).click();
    await expect(page.getByRole("textbox", { name: "Message your Career Copilot" })).toHaveValue(/I would add idempotency keys/);
    await expect(page.getByRole("button", { name: "Next question" })).toBeVisible();
    expect(calls).toBe(2);
    const cookieDecline = page.getByRole("button", { name: "Decline", exact: true });
    if (await cookieDecline.isVisible()) await cookieDecline.click();
    await testInfo.attach("occ-m8-interview-feedback-desktop", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
    await page.getByRole("button", { name: "Next question" }).click();
    await expect(page.getByRole("region", { name: "Interview coach question" }).last()).toContainText("Question 2 of 5");
    expect(await db.document.count({ where: { userId: e2eUser.id } })).toBe(0);
  });

  test("M8 interview is responsive and never starts AI requests just from selecting a suggestion", async ({ page, db, e2eUser }, testInfo) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    let called = false;
    await page.route("**/api/occ/interview", route => { called = true; return route.abort(); });
    await page.goto("/occ");
    await page.getByRole("button", { name: "Prepare for an interview" }).click();
    await expect(page.getByRole("region", { name: "Mock interview workspace" })).toBeVisible();
    expect(called).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const cookieDecline = page.getByRole("button", { name: "Decline", exact: true });
    if (await cookieDecline.isVisible()) await cookieDecline.click();
    await testInfo.attach("occ-m8-interview-mobile", {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }), contentType: "image/png",
    });
  });

  test("anonymous callers cannot access protected OCC endpoints", async ({ page }) => {
    expect((await page.request.get("/occ")).status()).toBe(404);
    expect((await page.request.get("/api/occ/profile")).status()).toBe(403);
    expect((await page.request.get("/api/occ/runs")).status()).toBe(403);
    expect((await page.request.post("/api/occ/advise", { data: {} })).status()).toBe(403);
    expect((await page.request.post("/api/occ/interview", { data: {} })).status()).toBe(403);
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
