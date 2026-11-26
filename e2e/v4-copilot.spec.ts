import { test, expect, signIn } from "./fixtures";

/**
 * v4 Copilot and Interview. DRAFT: written from the component code without a
 * running server, so a selector or timing may need one adjustment on first run.
 * Needs the same setup as the other OCC specs (ORIRE_OCC_ENABLED=true; the e2e
 * user is allowed in by occIsolatedE2eFixtureAllowed).
 */
test.describe("v4 Copilot", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "Run with ORIRE_OCC_ENABLED=true");

  test.beforeEach(async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("the Copilot is its own menu item and the header switch moves between it and the Studio", async ({ page }) => {
    await page.goto("/app/copilot");
    const menu = page.getByRole("navigation", { name: "Orire" });
    await expect(menu.getByRole("link", { name: "Copilot" })).toHaveAttribute("aria-current", "page");
    const toggle = page.getByRole("switch", { name: "Copilot" });
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await toggle.click();
    await expect(page).toHaveURL(/\/app\/studio$/);
    await expect(menu.getByRole("link", { name: "CV Studio" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("switch", { name: "Copilot" })).toHaveAttribute("aria-checked", "false");

    await page.getByRole("switch", { name: "Copilot" }).click();
    await expect(page).toHaveURL(/\/app\/copilot$/);
  });

  test("a message with no keyword gets a model reply and a button for the action it suggests", async ({ page }) => {
    let calls = 0;
    await page.route("**/api/occ/chat", async (route) => {
      calls++;
      const body = route.request().postDataJSON();
      expect(body.message).toBe("What should I focus on this week?");
      await route.fulfill({ json: { intent: "review", reply: "Start by checking your CV against the role." } });
    });
    await page.goto("/app/copilot");
    const box = page.getByRole("textbox", { name: "Message the Career Copilot" });
    await box.fill("What should I focus on this week?");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("Start by checking your CV against the role.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Review my CV" }).last()).toBeVisible();
    expect(calls).toBe(1);
  });

  test("when the plan's replies are used up the chat says so instead of failing", async ({ page }) => {
    await page.route("**/api/occ/chat", (route) =>
      route.fulfill({ status: 402, json: { error: "You've used all 5 Copilot replies.", code: "no-runs" } }));
    await page.goto("/app/copilot");
    await page.getByRole("textbox", { name: "Message the Career Copilot" }).fill("What should I focus on this week?");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("You've used your Copilot replies")).toBeVisible();
    await expect(page.getByRole("link", { name: "Compare plans" })).toBeVisible();
  });

  test("a Career chat saves itself and is there after a reload", async ({ page, db, e2eUser }) => {
    await page.route("**/api/occ/chat", (route) => route.fulfill({ json: { intent: null, reply: "Here is a short answer." } }));
    await page.goto("/app/copilot");
    await page.getByRole("textbox", { name: "Message the Career Copilot" }).fill("What should I focus on this week?");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("Here is a short answer.")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Saved automatically" })).toBeVisible({ timeout: 10_000 });

    const saved = await db.occConversation.findMany({ where: { userId: e2eUser.id }, include: { messages: true } });
    expect(saved).toHaveLength(1);
    expect(saved[0].messages.map((m) => m.text)).toContain("Here is a short answer.");

    await page.reload();
    await page.getByRole("button", { name: /What should I focus on this week\?/ }).click();
    await expect(page.getByText("Here is a short answer.")).toBeVisible();
  });
});

test.describe("v4 Interview page", () => {
  test.skip(process.env.ORIRE_OCC_ENABLED !== "true", "Run with ORIRE_OCC_ENABLED=true");
  const jd = "We are hiring a secondary teacher. Responsibilities include curriculum development, lesson planning, and helping students with mathematics.";

  test("five-step practice: question, answer, feedback", async ({ page, db, e2eUser }) => {
    await db.entitlement.create({ data: { userId: e2eUser.id, plan: "career" } });
    await signIn(page);
    await page.route("**/api/occ/interview", async (route) => {
      const data = route.request().postDataJSON();
      if (data.mode === "question") {
        await route.fulfill({ json: { question: { question: "Tell me about teaching a hard topic.", focus: "Teaching approach", answerStarters: ["Start with a real example.", "Describe what you did."] } } });
      } else {
        expect(data.answer.length).toBeGreaterThanOrEqual(20);
        await route.fulfill({ json: { feedback: { strength: "You gave a classroom example.", improvement: "Say what changed for the students.", example: null, followUp: "How did you check understanding?", betterWording: null, whyBetter: null } } });
      }
    });
    await page.goto("/app/studio/interview");
    await page.getByPlaceholder("Paste the full job posting here.").fill(jd);
    await page.getByRole("button", { name: "Start the interview" }).click();
    await expect(page.getByRole("heading", { name: "Tell me about teaching a hard topic." })).toBeVisible();
    const send = page.getByRole("button", { name: "Get feedback" });
    await expect(send).toBeDisabled();
    await page.getByPlaceholder("Write your answer here.").fill("I teach new topics with a worked example, then students practise in pairs.");
    await send.click();
    await expect(page.getByRole("heading", { name: "Feedback" })).toBeVisible();
    await expect(page.getByText("You gave a classroom example.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Next question" })).toBeVisible();
  });
});
