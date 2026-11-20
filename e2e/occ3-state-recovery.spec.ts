import { test, expect, signIn } from "./fixtures";

test.describe("OCC 3.1.3 agent state isolation and recovery", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "OCC-enabled gate only");

  const cv = "Professional Summary: Experienced teacher supporting curriculum planning. Work experience: Teaching mathematics to secondary school students and creating lesson plans. Education: Bachelor degree in education. Skills: Communication, classroom management and collaboration.";
  const jd = "We are hiring a secondary teacher. Responsibilities include curriculum development, lesson planning, assessment design, and helping students with mathematics.";

  async function open(page: import("@playwright/test").Page) {
    await signIn(page);
    await page.goto("/occ/preview");
    const cookie = page.getByRole("dialog", { name: "Cookie consent" });
    await cookie.waitFor({ state: "visible", timeout: 4000 }).catch(() => {});
    if (await cookie.isVisible()) await cookie.getByRole("button", { name: "Decline" }).click();
    return page.getByRole("form", { name: "OCC 3.0 composer" });
  }

  async function attachCv(page: import("@playwright/test").Page, composer: import("@playwright/test").Locator) {
    await page.locator('input[type="file"]').setInputFiles({
      name: "teacher-cv.txt", mimeType: "text/plain", buffer: Buffer.from(cv),
    });
    await composer.getByRole("button", { name: "Send message" }).click();
  }

  const successAdvice = {
    advice: { summary: "Recovered response", recommendations: [], nextSteps: [], disclaimer: "Verify suggestions." },
  };

  test("Review recovers from a failed request and retry uses the same CV and current focus", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const composer = await open(page);
    await attachCv(page, composer);

    let attempts = 0;
    const bodies: Array<Record<string, unknown>> = [];
    await page.route("**/api/occ/general-review", async route => {
      attempts++;
      bodies.push(route.request().postDataJSON() as Record<string, unknown>);
      if (attempts === 1) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporary review failure." }) });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(successAdvice) });
      }
    });

    const input = composer.getByRole("textbox", { name: "Message Orire Career Copilot" });
    await input.fill("Focus on how clearly I communicate impact.");
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("alert")).toContainText("Temporary review failure.");
    await expect(composer.getByRole("button", { name: "Send message" })).toBeEnabled();

    await input.fill("Focus instead on curriculum planning evidence.");
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Here's your general CV review.")).toBeVisible();

    expect(bodies).toHaveLength(2);
    expect(bodies[0].cv).toContain("Teaching mathematics");
    expect(bodies[1].cv).toContain("Teaching mathematics");
    expect(bodies[1].focus).toBe("Focus instead on curriculum planning evidence.");
  });

  test("Coach failure clears busy state and a retry uses the newest goal", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const composer = await open(page);
    await composer.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: "Coach" }).click();
    await attachCv(page, composer);

    let attempts = 0;
    const bodies: Array<Record<string, unknown>> = [];
    await page.route("**/api/occ/coach", async route => {
      attempts++;
      bodies.push(route.request().postDataJSON() as Record<string, unknown>);
      if (attempts === 1) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Coaching unavailable." }) });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(successAdvice) });
      }
    });

    const input = composer.getByRole("textbox", { name: "Message Orire Career Copilot" });
    await input.fill("Help me move into curriculum leadership.");
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("alert")).toContainText("Coaching unavailable.");
    await expect(composer.getByRole("button", { name: "Select agent" })).toBeEnabled();

    const retryGoal = "Help me identify the strongest next step toward curriculum leadership.";
    await input.fill(retryGoal);
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("region", { name: "Career coaching guidance" })).toBeVisible();

    expect(bodies).toHaveLength(2);
    expect(bodies[1].goal).toBe(retryGoal);
  });

  test("Interview feedback failure preserves the active question so the candidate can retry", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const composer = await open(page);
    await composer.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: "Interview" }).click();
    await attachCv(page, composer);

    let feedbackAttempts = 0;
    const question = "Tell me how you introduce a difficult mathematics concept.";
    await page.route("**/api/occ/interview", async route => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      if (body.mode === "question") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
          question: { question, focus: "Teaching approach", answerStarters: ["Use an example.", "Explain your sequence."] },
        }) });
        return;
      }
      feedbackAttempts++;
      if (feedbackAttempts === 1) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Feedback unavailable." }) });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
          feedback: { strength: "Clear approach.", improvement: "Add the result.", example: null, followUp: null, betterWording: null, whyBetter: null },
        }) });
      }
    });

    const input = composer.getByRole("textbox", { name: "Message Orire Career Copilot" });
    await input.fill(jd);
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("region", { name: "Interview question 1" })).toContainText(question);

    const firstAnswer = "I introduce a practical example, explain each step, then ask students to practise and explain it back.";
    await input.fill(firstAnswer);
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("alert")).toContainText("Feedback unavailable.");

    const retryAnswer = "I start with a practical example, model the method, then check understanding through guided practice.";
    await input.fill(retryAnswer);
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("region", { name: "Interview feedback 1" })).toContainText("Clear approach.");
    expect(feedbackAttempts).toBe(2);
  });

  test("agent switch after a failed Coach request leaves Review usable and isolated", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const composer = await open(page);
    await composer.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: "Coach" }).click();
    await attachCv(page, composer);

    await page.route("**/api/occ/coach", async route => {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Coach failed." }) });
    });
    let reviewCalls = 0;
    await page.route("**/api/occ/general-review", async route => {
      reviewCalls++;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(successAdvice) });
    });

    const input = composer.getByRole("textbox", { name: "Message Orire Career Copilot" });
    await input.fill("Help me plan my next career step.");
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("alert")).toContainText("Coach failed.");

    await composer.getByRole("button", { name: "Select agent" }).click();
    await page.getByRole("option", { name: "Review" }).click();
    await input.fill("Review how clearly my CV communicates teaching impact.");
    await composer.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByText("Here's your general CV review.")).toBeVisible();
    expect(reviewCalls).toBe(1);
  });

  test("New chat after an error fully resets error and processing state", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    const composer = await open(page);
    await attachCv(page, composer);

    await page.route("**/api/occ/general-review", async route => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Review exploded." }) });
    });

    const input = composer.getByRole("textbox", { name: "Message Orire Career Copilot" });
    await input.fill("Review my CV.");
    await composer.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("alert")).toContainText("Review exploded.");

    await page.getByRole("button", { name: "New chat" }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText("Reading document", { exact: false })).toHaveCount(0);
    await expect(composer.getByRole("button", { name: "Select agent" })).toContainText("Review");
    await expect(composer.getByRole("button", { name: "Send message" })).toBeDisabled();
  });
});
