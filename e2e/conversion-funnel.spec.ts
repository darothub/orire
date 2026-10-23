import { test, expect, signIn, waitForShell } from "./fixtures";

async function observe(page: import("@playwright/test").Page, consent: "granted" | "denied") {
  // Capture SDK calls locally; do not load analytics or send production traffic.
  await page.route("**/_vercel/**", (route) => route.fulfill({ body: "", contentType: "application/javascript" }));
  await page.route("**/static.cloudflareinsights.com/**", (route) => route.abort());
  await page.addInitScript((choice) => {
    localStorage.setItem("orire-consent", choice);
    localStorage.setItem("orire-onboarded", "1");
    const w = window as unknown as { va: (event: string, payload: unknown) => void; capturedFunnel: unknown[] };
    w.capturedFunnel = [];
    w.va = (event, payload) => { if (event === "event") w.capturedFunnel.push(payload); };
  }, consent);
}
async function events(page: import("@playwright/test").Page) {
  return page.evaluate(() => (window as unknown as { capturedFunnel: { name: string; data: Record<string, string> }[] }).capturedFunnel);
}

test("@smoke UX98 consented landing milestones dedupe and stop after withdrawal", async ({ page }) => {
  await observe(page, "granted");
  await page.goto("/");
  await expect.poll(async () => (await events(page)).map((e) => e.name)).toContain("landing_viewed");
  const cta = page.getByRole("button", { name: "Create your CV" }).first();
  await cta.click();
  await expect(page.getByRole("dialog", { name: "Create your account" })).toBeVisible();
  await page.getByRole("button", { name: "Close and return to the landing page" }).click();
  await cta.click();
  await expect.poll(async () => (await events(page)).filter((e) => e.name === "signup_started").length).toBe(1);
  expect((await events(page)).filter((e) => e.name === "landing_cta_clicked")).toHaveLength(1);
  await page.getByRole("button", { name: "Close and return to the landing page" }).click();
  await page.getByRole("button", { name: /Cookie preferences/i }).click();
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  const count = (await events(page)).length;
  await cta.click();
  await expect(page.getByRole("dialog", { name: "Create your account" })).toBeVisible();
  expect((await events(page)).length).toBe(count);
});

test("@smoke UX98 editor and successful download emit only anonymous milestones", async ({ page }) => {
  await observe(page, "granted");
  await signIn(page);
  await page.goto("/");
  await waitForShell(page);
  const rail = page.getByRole("navigation", { name: "Workspaces" });
  await rail.getByRole("button", { name: "Edit", exact: true }).click();
  await page.locator(".pick-card").filter({ hasText: "Noir" }).click();
  await page.locator(".pick-card").filter({ hasText: "Noir" }).click();
  const name = page.getByText("Full name").locator("..").locator("input");
  await name.fill("Fictional Private Candidate");
  await name.fill("Fictional Private Candidate Again");
  await rail.getByRole("button", { name: "Export", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .txt" }).click();
  await download;
  await expect.poll(async () => (await events(page)).filter((e) => e.name === "first_cv_exported").length).toBe(1);
  const payloads = await events(page);
  expect(payloads.filter((e) => e.name === "first_cv_edited")).toHaveLength(1);
  expect(payloads.filter((e) => e.name === "template_chosen")).toEqual([{ name: "template_chosen", data: { template: "noir" } }]);
  expect(payloads.find((e) => e.name === "first_cv_exported")?.data).toEqual({ format: "txt" });
  expect(JSON.stringify(payloads)).not.toMatch(/Private Candidate|@|token|job description/i);
});

test("@smoke UX98 opt-out queues no landing or signup events", async ({ page }) => {
  await observe(page, "denied");
  await page.goto("/");
  await page.getByRole("button", { name: "Create your CV" }).first().click();
  await expect(page.getByRole("dialog", { name: "Create your account" })).toBeVisible();
  expect(await events(page)).toEqual([]);
});
