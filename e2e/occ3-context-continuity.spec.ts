import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3.1.2 conversation context continuity", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC-enabled gate only");

  const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";
  const jd = "We are hiring a secondary teacher. Responsibilities include curriculum development, lesson planning, assessment design, and helping students with mathematics.";

  async function openPreview(page: import("@playwright/test").Page) {
    await signIn(page);
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    await cookie.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();
    return page.getByRole("form", { name: "OCC 3.0 composer" });
  }

  async function attachCv(page: import("@playwright/test").Page, composer: import("@playwright/test").Locator) {
    await page.locator('input[type="file"]').setInputFiles({
      name: "teacher-cv.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(cv),
    });
    await composer.getByRole("button", { name: "Send message" }).click();
  }

  const advice = {
    advice: {
      summary: "Grounded response",
      recommendations: [],
      nextSteps: [],
      disclaimer: "Verify all suggestions.",
    },
  };

  test("Review keeps the active CV and JD across multiple follow-up turns", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const composer = await openPreview(page);
    await attachCv(page, composer);
    await page.getByRole("button", { name: "I have a job description" }).click();

    const calls: Array<Record<string, unknown>> = [];
    await page.route("**/api/occ/advise", async route => {
      calls.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(advice) });
    });

    const input = composer.getByRole("textbox", { name: "Message Orire Career Copilot" });
    await input.fill(jd);
    await composer.getByRole("button", { name: "Send message" }).click();

    const firstFollowUp = "Focus on assessment design.";
    await input.fill(firstFollowUp);
    await composer.getByRole("button", { name: "Send message" }).click();

    const secondFollowUp = "Now focus on how clearly I communicate classroom impact.";
    await input.fill(secondFollowUp);
    await composer.getByRole("button", { name: "Send message" }).click();

    await expect.poll(() => calls.length).toBe(3);
    for (const call of calls) {
      expect(call.cv).toContain("Teaching mathematics");
      expect(call.description).toBe(jd);
    }
    expect(calls[1].goal).toBe(firstFollowUp);
    expect(calls[2].goal).toBe(secondFollowUp);
  });

  test("Coach keeps the active JD for later coaching turns but uses the newest user goal", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const composer = await openPreview(page);
    await composer.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: "Coach" }).click();
    await attachCv(page, composer);

    const calls: Array<Record<string, unknown>> = [];
    await page.route("**/api/occ/coach", async route => {
      calls.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(advice) });
    });

    await page.getByLabel("Coaching goals").getByRole("button", { name: "I have a target role" }).click();
    const input = composer.getByRole("textbox", { name: "Message Orire Career Copilot" });
    await input.fill(jd);
    await composer.getByRole("button", { name: "Send message" }).click();

    const followUp = "What gap should I address first for this role?";
    await input.fill(followUp);
    await composer.getByRole("button", { name: "Send message" }).click();

    await expect.poll(() => calls.length).toBe(2);
    expect(calls[0].description).toBe(jd);
    expect(calls[1].description).toBe(jd);
    expect(calls[1].goal).toBe(followUp);
  });

  test("Interview preserves the active JD across question and feedback turns", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const composer = await openPreview(page);
    await composer.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: "Interview" }).click();
    await attachCv(page, composer);

    const calls: Array<Record<string, unknown>> = [];
    const firstQuestion = "Tell me how you teach a difficult mathematics topic.";
    await page.route("**/api/occ/interview", async route => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      calls.push(body);
      if (body.mode === "question") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ question: { question: firstQuestion, focus: "Teaching approach", answerStarters: ["Use an example.", "Explain your steps."] } }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ feedback: { strength: "Clear structure.", improvement: "Add the observed result.", example: null, followUp: null, betterWording: null, whyBetter: null } }),
        });
      }
    });

    const input = composer.getByRole("textbox", { name: "Message Orire Career Copilot" });
    await input.fill(jd);
    await composer.getByRole("button", { name: "Send message" }).click();

    const answer = "I start with a practical example, then guide students through practice and ask them to explain it back.";
    await input.fill(answer);
    await composer.getByRole("button", { name: "Send message" }).click();

    await expect.poll(() => calls.length).toBe(2);
    expect(calls[0].description).toBe(jd);
    expect(calls[1].description).toBe(jd);
    expect(calls[1].question).toBe(firstQuestion);
    expect(calls[1].answer).toBe(answer);
  });

  test("switching away from Interview clears temporary interview turn state", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const composer = await openPreview(page);
    await composer.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: "Interview" }).click();
    await attachCv(page, composer);

    let interviewCalls = 0;
    await page.route("**/api/occ/interview", async route => {
      interviewCalls++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ question: { question: "Tell me about your teaching approach.", focus: "Approach", answerStarters: ["Use an example.", "Explain your steps."] } }),
      });
    });

    const input = composer.getByRole("textbox", { name: "Message Orire Career Copilot" });
    await input.fill(jd);
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("region", { name: "Interview question 1" })).toBeVisible();

    await composer.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: "Review" }).click();
    await composer.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: "Interview" }).click();

    await input.fill("This should start a fresh interview context.");
    await composer.getByRole("button", { name: "Send message" }).click();
    expect(interviewCalls).toBe(2);
  });

  test("switching away from Coach clears the old coach goal before collecting a new target role", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const composer = await openPreview(page);
    await composer.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: "Coach" }).click();
    await attachCv(page, composer);

    const calls: Array<Record<string, unknown>> = [];
    await page.route("**/api/occ/coach", async route => {
      calls.push(route.request().postDataJSON() as Record<string, unknown>);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(advice) });
    });

    const oldGoal = "Help me move into curriculum leadership.";
    const input = composer.getByRole("textbox", { name: "Message Orire Career Copilot" });
    await input.fill(oldGoal);
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect.poll(() => calls.length).toBe(1);

    await composer.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: "Review" }).click();
    await composer.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: "Coach" }).click();
    await page.getByLabel("Coaching goals").getByRole("button", { name: "I have a target role" }).click();

    await input.fill(jd);
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect.poll(() => calls.length).toBe(2);

    expect(calls[1].description).toBe(jd);
    expect(calls[1].goal).toBe("Help me prepare for this target role");
    expect(calls[1].goal).not.toBe(oldGoal);
  });

  test("New chat clears CV, JD, agent selection and temporary conversation state", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const composer = await openPreview(page);
    await composer.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: "Coach" }).click();
    await attachCv(page, composer);

    await page.getByRole("button", { name: "New chat" }).click();

    await expect(page.getByRole("heading", { name: /Orire Career Copilot/ })).toBeVisible();
    await expect(composer.getByRole("button", { name: "Select agent" })).toContainText("Review");
    await expect(composer.getByRole("button", { name: "Send message" })).toBeDisabled();
    await expect(composer).not.toContainText("teacher-cv.txt");

    const input = composer.getByRole("textbox", { name: "Message Orire Career Copilot" });
    await input.fill("Use my previous CV and job description.");
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("alert")).toContainText("Attach your CV");
  });

  test("Career Memory remains separate from temporary conversation context", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const composer = await openPreview(page);
    await attachCv(page, composer);

    await composer.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: "Career Memory" }).click();

    let writes = 0;
    for (const pattern of ["**/api/occ/profile*", "**/api/occ/conversations*", "**/api/occ/history*"]) {
      await page.route(pattern, async route => { writes++; await route.abort(); });
    }

    const input = composer.getByRole("textbox", { name: "Message Orire Career Copilot" });
    await input.fill("Remember that I am interested in education leadership.");
    await composer.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByText("Career Memory remains private and opt-in.", { exact: false })).toBeVisible();
    expect(writes).toBe(0);

    await page.getByRole("button", { name: "New chat" }).click();
    await expect(page.getByText("Remember that I am interested in education leadership.", { exact: true })).toHaveCount(0);
  });
});
