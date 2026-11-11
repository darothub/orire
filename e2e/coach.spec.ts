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
  await page.getByRole("navigation", { name: "Workspaces" }).getByRole("button", { name: "Tailor", exact: true }).click();
  await page.getByRole("button", { name: "Open Coach", exact: true }).click();
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

test("tailor inbox: a proposal stays usable after the CV is edited, and keeps the edit", async ({ appPage, db, e2eUser }) => {
  await asPro(appPage, db, e2eUser.id);
  await stubAgents(appPage);
  await openCoach(appPage);
  await appPage.getByLabel("Job description").fill("Senior TypeScript engineer.");
  await appPage.getByRole("button", { name: "Analyse my CV" }).click();
  await appPage.getByLabel("By how much did the redesign lift engagement?").fill("34% weekly active use");
  await appPage.getByRole("button", { name: "Rewrite with 1 answer" }).click();
  await expect(appPage.getByText("33% → 67%")).toBeVisible();

  // Edit a different part of the CV while the proposal is still open.
  const rail = appPage.getByRole("navigation", { name: "Workspaces" });
  await rail.getByRole("button", { name: "Edit", exact: true }).click();
  await appPage.getByLabel("Title", { exact: true }).fill("Principal Engineer");

  await rail.getByRole("button", { name: "Tailor", exact: true }).click();
  const inbox = appPage.getByRole("region", { name: "Review changes" });
  await expect(inbox).toContainText("Coach: 1 change ready to review");
  await expect(inbox).toContainText("Your CV changed since this was made");
  await inbox.getByRole("button", { name: "Review" }).click();

  await expect(appPage.getByText("Your CV changed since this was made.")).toBeVisible();
  await appPage.getByRole("button", { name: "Accept all" }).click();
  await appPage.getByRole("button", { name: /Apply 1 change/ }).click();
  await expect(appPage.locator("#cv-paper")).toContainText("Lifted engagement 34% (from your answer).");
  await expect(appPage.locator("#cv-paper")).toContainText("Principal Engineer");

  // One accept is one undo step.
  await rail.getByRole("button", { name: "Tailor", exact: true }).click();
  await appPage.getByRole("button", { name: "Undo" }).click();
  await rail.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(appPage.locator("#cv-paper")).not.toContainText("Lifted engagement 34%");
  await expect(appPage.locator("#cv-paper")).toContainText("Principal Engineer");
});

test("tailor facts: an answer is kept, reused on the next run, synced to the account, and deletable", async ({ appPage, db, e2eUser }) => {
  await asPro(appPage, db, e2eUser.id);
  await stubAgents(appPage);
  await openCoach(appPage);
  await appPage.getByLabel("Job description").fill("Senior TypeScript engineer.");
  await appPage.getByRole("button", { name: "Analyse my CV" }).click();
  await appPage.getByLabel("By how much did the redesign lift engagement?").fill("34% weekly active use");
  await appPage.getByRole("button", { name: "Rewrite with 1 answer" }).click();
  await expect(appPage.getByText("33% → 67%")).toBeVisible();

  const rail = appPage.getByRole("navigation", { name: "Workspaces" });
  await rail.getByRole("button", { name: "Tailor", exact: true }).click();
  const facts = appPage.getByRole("region", { name: /Your verified facts/ });
  await expect(facts).toContainText("34% weekly active use");

  await expect
    .poll(async () => JSON.stringify((await db.user.findUnique({ where: { id: e2eUser.id }, select: { factLedger: true } }))?.factLedger ?? null))
    .toContain("34% weekly active use");

  // The next Coach run starts with the earlier answer filled in.
  await appPage.getByRole("button", { name: "Open Coach", exact: true }).click();
  await appPage.getByRole("button", { name: "Start over" }).click();
  await appPage.getByLabel("Job description").fill("Another TypeScript role.");
  await appPage.getByRole("button", { name: "Analyse my CV" }).click();
  await expect(appPage.getByLabel("By how much did the redesign lift engagement?")).toHaveValue("34% weekly active use");
  await expect(appPage.getByText("From your earlier answer")).toBeVisible();

  await rail.getByRole("button", { name: "Tailor", exact: true }).click();
  await appPage.getByRole("button", { name: /^Delete fact/ }).click();
  await expect(appPage.getByRole("region", { name: /Your verified facts/ })).toHaveCount(0);
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
  await appPage.getByRole("navigation", { name: "Workspaces" }).getByRole("button", { name: "Tailor", exact: true }).click();
  await appPage.getByRole("button", { name: "Open Coach", exact: true }).click();
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

test("tailor hub: one job description is shared with the tools, and all three are reachable", async ({ appPage, db, e2eUser }) => {
  await asPro(appPage, db, e2eUser.id);
  await stubAgents(appPage);
  await openCoach(appPage);
  await appPage.getByLabel("Job description").fill("Senior TypeScript engineer.");
  await appPage.getByRole("navigation", { name: "Workspaces" }).getByRole("button", { name: "Tailor", exact: true }).click();
  await expect(appPage.getByRole("heading", { name: "Tailor to a job" })).toBeVisible();
  await expect(appPage.getByLabel("Job description")).toHaveValue("Senior TypeScript engineer.");
  for (const tool of ["Simulate", "Coach", "Refine"]) {
    await expect(appPage.getByRole("button", { name: `Open ${tool}`, exact: true })).toBeVisible();
  }
});

test("tailor run all: guided steps can be skipped, then the before and after shows", async ({ appPage, db, e2eUser }) => {
  await asPro(appPage, db, e2eUser.id);
  await stubAgents(appPage);
  await openCoach(appPage);
  const rail = appPage.getByRole("navigation", { name: "Workspaces" });
  // Touch the CV so it counts as the candidate's own.
  await rail.getByRole("button", { name: "Edit", exact: true }).click();
  await appPage.getByLabel("Title", { exact: true }).fill("Staff TypeScript Engineer");
  await rail.getByRole("button", { name: "Tailor", exact: true }).click();
  await appPage.getByLabel("Job description").fill("Senior TypeScript engineer. React, GraphQL, AWS.");

  await appPage.getByRole("button", { name: "Start guided run" }).click();
  const bar = appPage.getByRole("region", { name: "Guided run" });
  await expect(bar).toContainText("step 1 of 3: Diagnose");
  await bar.getByRole("button", { name: "Skip this step" }).click();
  await expect(bar).toContainText("step 2 of 3: Coach");
  await bar.getByRole("button", { name: "Skip this step" }).click();
  await expect(bar).toContainText("step 3 of 3: Refine");
  await bar.getByRole("button", { name: "Done, next step" }).click();

  const panel = appPage.getByRole("region", { name: "Run complete" });
  await expect(panel).toContainText("Diagnose: skipped");
  await expect(panel).toContainText("Refine: done");
  await expect(panel).toContainText("Match before:");
});

test("tailor run all: Free users see the plans prompt, not the run", async ({ appPage }) => {
  await appPage.getByRole("navigation", { name: "Workspaces" }).getByRole("button", { name: "Tailor", exact: true }).click();
  await expect(appPage.getByRole("button", { name: /Run all is a Pro feature/ })).toBeVisible();
  await expect(appPage.getByRole("button", { name: "Start guided run" })).toHaveCount(0);
});

test("tailor seeds: Simulate's missing skills reach Coach as hints", async ({ appPage, db, e2eUser }) => {
  await asPro(appPage, db, e2eUser.id);
  await stubAgents(appPage);
  const ideal = {
    basics: { name: "Ideal", title: "Senior TypeScript Engineer", email: "", phone: "", location: "", summary: "", links: [] },
    experience: [],
    education: [],
    skills: [{ category: "Platform", items: ["Terraform", "Kubernetes"] }],
    projects: [],
  };
  await appPage.route("**/api/ai/simulate", (route) =>
    route.fulfill({ json: { ok: true, provider: "stub", model: "stub", raw: JSON.stringify(ideal) } }),
  );
  await openCoach(appPage);
  await appPage.getByLabel("Job description").fill("Senior TypeScript engineer. Terraform, Kubernetes.");
  const rail = appPage.getByRole("navigation", { name: "Workspaces" });
  await rail.getByRole("button", { name: "Tailor", exact: true }).click();
  await appPage.getByRole("button", { name: "Open Simulate", exact: true }).click();
  await appPage.getByRole("button", { name: "Generate role-target example" }).click();
  await expect(appPage.getByRole("button", { name: "Generate role-target example" })).toHaveCount(0);

  await rail.getByRole("button", { name: "Tailor", exact: true }).click();
  await appPage.getByRole("button", { name: "Open Coach", exact: true }).click();
  await expect(appPage.getByTestId("coach-seeds")).toContainText("Terraform");
  // A different job means the target is for another role, so its hints are dropped.
  await appPage.getByLabel("Job description").fill("Staff designer.");
  await expect(appPage.getByTestId("coach-seeds")).toHaveCount(0);
  await appPage.getByLabel("Job description").fill("Senior TypeScript engineer. Terraform, Kubernetes.");
  await expect(appPage.getByTestId("coach-seeds")).toContainText("Terraform");

  const analyze = appPage.waitForRequest((r) => r.url().includes("/api/ai/agents") && r.postDataJSON()?.action === "analyze");
  await appPage.getByRole("button", { name: "Analyse my CV" }).click();
  expect((await analyze).postDataJSON().seeds).toEqual(expect.arrayContaining(["Terraform", "Kubernetes"]));
});
