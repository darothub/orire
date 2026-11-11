import { test, expect, waitForShell } from "./fixtures";
import type { Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";

/**
 * CV coach UI, with /api/ai/agents stubbed (the production build the suite runs
 * against has no mock model). Server-side gating is covered by the unit tests
 * in src/lib/plan/coachGate.test.ts.
 */

const analysis = {
  ok: true,
  runToken: "stub-token",
  profile: { roleTitle: "Engineer", seniority: "senior", mustHaves: ["TypeScript"], niceToHaves: [], keywords: ["TypeScript"], tone: "clear" },
  report: {
    matched: ["Design systems"],
    understated: [{ area: "Measured impact", advice: "Add numbers" }],
    plausible: [],
    genuineGap: [{ area: "Kubernetes", advice: "Not on your CV; we won’t add it." }],
    weakBullets: [],
  },
  questions: [{ id: "q1", targets: "Measured impact", prompt: "By how much did the redesign lift engagement?", kind: "metric" }],
};

async function stubAgents(page: Page, opts: { capped?: boolean } = {}) {
  const calls: string[] = [];
  await page.route("**/api/ai/agents", async (route) => {
    const body = route.request().postDataJSON() as { action: string; cv: { basics: { summary: string } }; answers?: unknown[] };
    calls.push(body.action);
    if (body.action === "analyze") {
      if (opts.capped) {
        await route.fulfill({ status: 402, json: { ok: false, error: "You’ve used all 10 coach runs this month on Pro. Upgrade to Career for more." } });
        return;
      }
      await route.fulfill({ json: analysis });
    } else if (body.action === "critique") {
      await route.fulfill({
        json: { ok: true, critique: { recruiter: { issues: [], keepGoing: false }, ats: { missingKeywords: [], parseRisks: [], keepGoing: false } } },
      });
    } else {
      const cv = structuredClone(body.cv);
      cv.basics.summary = `${cv.basics.summary} Lifted engagement 34% (from your answer).`;
      await route.fulfill({
        json: {
          ok: true,
          cv,
          warnings: [],
          grounding: { score: 100, label: "clean", counts: { total: 0, entity: 0, number: 0, skill: 0 } },
          ats: { before: { score: 33, matched: [], missing: [] }, after: { score: 67, matched: [], missing: [] } },
        },
      });
    }
  });
  return calls;
}

/** Give this test's user a real Pro entitlement, then reload so the client mirrors it. */
async function asPro(page: Page, db: PrismaClient, userId: string) {
  await db.entitlement.create({ data: { userId, plan: "pro" } });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForShell(page);
}

async function openCoach(page: Page) {
  const consent = page.getByRole("dialog", { name: "Cookie consent" });
  await expect(consent).toBeVisible({ timeout: 15_000 });
  await consent.getByRole("button", { name: "Decline" }).click();
  await expect(consent).toBeHidden();
  await page.getByRole("navigation", { name: "Workspaces" }).getByRole("button", { name: "Refine", exact: true }).click();
  await page.getByRole("button", { name: "Try the CV coach" }).click();
  await expect(page.getByRole("heading", { name: "Coach me to the role" })).toBeVisible();
}

test("coach: answer questions, review the diff, apply only what is accepted", async ({ appPage, db, e2eUser }) => {
  await asPro(appPage, db, e2eUser.id);
  const calls = await stubAgents(appPage);
  await openCoach(appPage);

  await appPage.getByLabel("Job description").fill("Senior TypeScript engineer.");
  await appPage.getByRole("button", { name: "Analyse my CV" }).click();

  await expect(appPage.locator(".coach-gaps")).toContainText("we won’t fake these");
  await expect(appPage.locator(".coach-gaps")).toContainText("Kubernetes");
  const answer = appPage.getByLabel("By how much did the redesign lift engagement?");
  await answer.fill("34% weekly active use");
  await expect(appPage.getByText("21/600")).toBeVisible();
  await appPage.getByRole("button", { name: "Rewrite with 1 answer" }).click();

  await expect(appPage.getByText("33% → 67%")).toBeVisible();
  const apply = appPage.getByRole("button", { name: /Select changes to apply/ });
  await expect(apply).toBeDisabled(); // every change starts rejected
  await appPage.getByRole("button", { name: "Accept all" }).click();
  await appPage.getByRole("button", { name: /Apply 1 change/ }).click();
  await expect(appPage.locator("#cv-paper")).toContainText("Lifted engagement 34% (from your answer).");
  expect(calls).toEqual(["analyze", "rewrite", "critique"]);
});

test("coach: a refresh mid-run restores the questions and answers", async ({ appPage, db, e2eUser }) => {
  await asPro(appPage, db, e2eUser.id);
  await stubAgents(appPage);
  await openCoach(appPage);
  await appPage.getByLabel("Job description").fill("Senior TypeScript engineer.");
  await appPage.getByRole("button", { name: "Analyse my CV" }).click();
  await appPage.getByLabel("By how much did the redesign lift engagement?").fill("34%");

  await appPage.reload({ waitUntil: "domcontentloaded" });
  await appPage.getByRole("navigation", { name: "Workspaces" }).waitFor();
  await appPage.getByRole("navigation", { name: "Workspaces" }).getByRole("button", { name: "Refine", exact: true }).click();
  await appPage.getByRole("button", { name: "Try the CV coach" }).click();
  await expect(appPage.getByLabel("By how much did the redesign lift engagement?")).toHaveValue("34%");

  await appPage.getByRole("button", { name: "Start over" }).click();
  await expect(appPage.getByLabel("Job description")).toBeVisible();
  expect(await appPage.evaluate(() => sessionStorage.getItem("orire-coach-run"))).toBeNull();
});

test("coach: shows the monthly limit message instead of failing silently", async ({ appPage, db, e2eUser }) => {
  await asPro(appPage, db, e2eUser.id);
  await stubAgents(appPage, { capped: true });
  await openCoach(appPage);
  await appPage.getByLabel("Job description").fill("Senior TypeScript engineer.");
  await appPage.getByRole("button", { name: "Analyse my CV" }).click();
  await expect(appPage.getByRole("alert").filter({ hasText: "all 10 coach runs this month" })).toBeVisible();
  await expect(appPage.getByRole("button", { name: "Analyse my CV" })).toBeVisible();
});

test("coach: Free users see the upgrade card, not the form", async ({ appPage }) => {
  await openCoach(appPage);
  await expect(appPage.getByText("The CV coach is a Pro feature.")).toBeVisible();
  await expect(appPage.getByRole("button", { name: "See plans" })).toBeVisible();
  await expect(appPage.getByLabel("Job description")).toHaveCount(0);
});

for (const width of [390, 320]) {
  test(`coach: no horizontal overflow at ${width}px`, async ({ appPage, db, e2eUser }) => {
    await asPro(appPage, db, e2eUser.id);
    await appPage.setViewportSize({ width, height: 800 });
    await stubAgents(appPage);
    await openCoach(appPage);
    await appPage.getByLabel("Job description").fill("Senior TypeScript engineer.");
    await appPage.getByRole("button", { name: "Analyse my CV" }).click();
    await expect(appPage.getByLabel("By how much did the redesign lift engagement?")).toBeVisible();
    const overflow = await appPage.evaluate(() => {
      const el = document.querySelector(".coach-flow") as HTMLElement;
      return el.scrollWidth - el.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
  });
}
