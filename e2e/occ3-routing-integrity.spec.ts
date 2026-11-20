import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3.1 agent conversation routing integrity", () => {
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

  test("Review preserves the JD and routes a later follow-up as the review goal", async ({ page, db, e2eUser }) => {
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
    await expect(page.getByText("Here's your CV review against the role you shared.")).toBeVisible();

    const followUp = "Focus next on whether my CV clearly demonstrates assessment design experience.";
    await input.fill(followUp);
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect.poll(() => calls.length).toBe(2);

    expect(calls[0].description).toBe(jd);
    expect(calls[0].goal).toBeUndefined();
    expect(calls[1].description).toBe(jd);
    expect(calls[1].goal).toBe(followUp);
    expect(calls[1].cv).toContain("Teaching mathematics");
  });

  test("Coach routes free-text goals with the CV and keeps the active JD on later coaching", async ({ page, db, e2eUser }) => {
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

    const input = composer.getByRole("textbox", { name: "Message Orire Career Copilot" });
    const firstGoal = "Help me decide whether curriculum leadership should be my next career step.";
    await input.fill(firstGoal);
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect.poll(() => calls.length).toBe(1);
    expect(calls[0].goal).toBe(firstGoal);
    expect(calls[0].description).toBeUndefined();
    expect(calls[0].cv).toContain("Teaching mathematics");

    await page.getByLabel("Coaching goals").getByRole("button", { name: "I have a target role" }).click().catch(() => {});
    // If the initial goal result replaced the goal cards, switch agents to re-enter the JD collection path.
    if (!(await page.getByText("Share the job description in the composer", { exact: false }).isVisible().catch(() => false))) {
      await composer.getByRole("button", { name: "Select agent" }).click();
      await page.getByRole("option", { name: "Review" }).click();
      await composer.getByRole("button", { name: "Select agent" }).click();
      await page.getByRole("option", { name: "Coach" }).click();
      await page.getByLabel("Coaching goals").getByRole("button", { name: "I have a target role" }).click();
    }

    await input.fill(jd);
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[1].description).toBe(jd);

    const laterGoal = "Now focus on what evidence from my experience best supports this role.";
    await input.fill(laterGoal);
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect.poll(() => calls.length).toBe(3);
    expect(calls[2].goal).toBe(laterGoal);
    expect(calls[2].description).toBe(jd);
  });

  test("Interview sends the exact visible JD, question and candidate answer to its service", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const composer = await openPreview(page);
    await composer.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: "Interview" }).click();
    await attachCv(page, composer);

    const calls: Array<Record<string, unknown>> = [];
    const question = "Tell me how you approach teaching a difficult mathematics topic.";
    await page.route("**/api/occ/interview", async route => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      calls.push(body);
      if (body.mode === "question") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ question: { question, focus: "Teaching approach", answerStarters: ["Use a concrete example.", "Explain your steps."] } }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ feedback: { strength: "Clear example.", improvement: "Add the observed result.", example: null, followUp: null, betterWording: null, whyBetter: null } }),
        });
      }
    });

    const input = composer.getByRole("textbox", { name: "Message Orire Career Copilot" });
    await input.fill(jd);
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("region", { name: "Interview question 1" })).toContainText(question);

    const answer = "I use a simple real-world example, then ask students to practise and explain the idea back to me.";
    await input.fill(answer);
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect.poll(() => calls.length).toBe(2);

    expect(calls[0].mode).toBe("question");
    expect(calls[0].description).toBe(jd);
    expect(calls[0].cv).toContain("Teaching mathematics");
    expect(calls[1].mode).toBe("feedback");
    expect(calls[1].description).toBe(jd);
    expect(calls[1].question).toBe(question);
    expect(calls[1].answer).toBe(answer);
  });

  test("Improve CV does not silently route free text to another agent after suggestions are shown", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const composer = await openPreview(page);
    await composer.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: /Improve CV/ }).click();

    let reviewCalls = 0;
    await page.route("**/api/occ/general-review", async route => {
      reviewCalls++;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(advice) });
    });
    let unexpectedCalls = 0;
    for (const pattern of ["**/api/occ/coach", "**/api/occ/interview", "**/api/occ/advise"]) {
      await page.route(pattern, async route => { unexpectedCalls++; await route.abort(); });
    }

    await attachCv(page, composer);
    await expect(page.getByText("Let's improve the wording together.", { exact: false })).toBeVisible();

    const input = composer.getByRole("textbox", { name: "Message Orire Career Copilot" });
    await input.fill("Rewrite my experience to sound more senior.");
    await composer.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByRole("alert")).toContainText("Use the in-chat improvement cards");
    expect(reviewCalls).toBe(1);
    expect(unexpectedCalls).toBe(0);
  });

  test("Career Memory stays opt-in and does not persist CV or chat text from the preview", async ({ page, db, e2eUser }) => {
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
    const note = "Remember that I prefer education leadership roles.";
    await input.fill(note);
    await composer.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByText(note, { exact: true })).toBeVisible();
    await expect(page.getByText("Career Memory remains private and opt-in.", { exact: false })).toBeVisible();
    expect(writes).toBe(0);
  });
});
