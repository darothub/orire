import { test, expect, signIn, waitForShell } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";
import { sampleCV } from "../src/lib/cv/sample";
import { meterFor } from "../src/lib/plan/plan";
import { addSessionCookie } from "./session";

/** UX151 acceptance: real Studio actions must navigate, not just look clickable. */
for (const viewport of [
  { width: 1440, height: 900, name: "desktop" },
  { width: 390, height: 844, name: "mobile" },
]) {
  test("Studio start CV and library remain reachable " + viewport.name, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await signIn(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForShell(page);
    const home = page.getByRole("heading", { name: "Your CV studio" });
    await expect(home).toBeVisible();
    const next = page.locator(".spot-studio-next");
    await expect(next).toBeVisible();
    await testInfo.attach("STUDIO-implemented-" + viewport.name, {
      body: await page.screenshot({ fullPage: true, animations: "disabled" }),
      contentType: "image/png",
    });
    await next.getByRole("button", { name: /Create your CV|Continue editing/ }).click();
    await expect(page.getByRole("heading", { name: "Edit", exact: true })).toBeVisible();
    const rail = page.getByRole("navigation", { name: "Workspaces" });
    // The Home brand button is intentionally hidden at <=820px; mobile users
    // return to Studio through the visible Add blocks entry in the rail.
    await rail.getByRole("button", {
      name: viewport.name === "mobile" ? "Add blocks" : "Home",
      exact: true,
    }).click();
    await expect(next).toBeVisible();
    await next.getByRole("button", { name: "Your library" }).click();
    await expect(page.getByRole("heading", { name: /Library|History|Your CVs/ })).toBeVisible();
  });
}

for (const width of [1440, 390, 320]) {
  for (const theme of ["dark", "light"] as const) {
    test(`Studio hierarchy and keyboard order at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await signIn(page);
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await waitForShell(page);
      const studio = page.locator(".spotlight-view");
      await expect(studio).toHaveCSS("opacity", "1");
      await expect(studio).toHaveCSS("transform", "none");
      await expect(studio).toHaveCSS("filter", "none");
      const context = page.getByRole("group", { name: "Current CV context" });
      await expect(context).toContainText("New CV");
      await expect(context).toContainText("Template: Aurora");
      const tools = page.getByRole("region", { name: "Your CV tools" });
      await expect(tools).toBeVisible();
      expect(await studio.evaluate((root) => {
        const order = [...root.children];
        return order.findIndex((el) => el.classList.contains("spot-studio-tools")) < order.findIndex((el) => el.classList.contains("spot-coach"))
          && order.findIndex((el) => el.classList.contains("spot-studio-tools")) < order.findIndex((el) => el.classList.contains("spot-hero"));
      })).toBe(true);
      const create = studio.getByRole("button", { name: "Create your CV →", exact: true });
      await create.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(create).toBeFocused();
      await expect(create).toHaveCSS("outline-style", "solid");
      await page.keyboard.press("Tab");
      await expect(studio.getByRole("button", { name: "Your library", exact: true })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(tools.getByRole("button", { name: /^Open Re-brand/ })).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const audit = await new AxeBuilder({ page }).include(".spotlight-view").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(audit.violations).toEqual([]);
    });
  }
}

for (const fullName of ["Fictional Studio Candidate", "   "]) {
  test(`Studio resumes the real cloud CV and handles ${fullName.trim() ? "a name" : "an empty name"}`, async ({ page, db, e2eUser }) => {
    const cv = { ...sampleCV, basics: { ...sampleCV.basics, fullName } };
    const document = await db.document.create({ data: {
      userId: e2eUser.id, title: "Fictional Studio CV", template: "noir", data: JSON.parse(JSON.stringify(cv)),
    } });
    await db.user.update({ where: { id: e2eUser.id }, data: { activeDocumentId: document.id } });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await signIn(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForShell(page);
    const context = page.getByRole("group", { name: "Current CV context" });
    await expect(context).toContainText(`Current CV: ${fullName.trim() || "Untitled CV"}`);
    await expect(context).toContainText("Template: Noir");
    await expect(page.getByRole("heading", { name: "Continue your CV", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Continue editing →" }).click();
    await expect(page.getByRole("heading", { name: "Edit", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Full name", exact: true })).toHaveValue(fullName);
  });
}

test("Studio tool toggles and relocated coach retain their behavior", async ({ appPage: page }) => {
  const tools = page.getByRole("region", { name: "Your CV tools" });
  const card = tools.locator(".spot-card").first();
  const toggle = card.getByRole("button", { name: "In your flow ✓", exact: true });
  await toggle.click();
  const add = card.getByRole("button", { name: "Add +", exact: true });
  await expect(add).toHaveAttribute("aria-pressed", "false");
  await add.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(page.locator(".spot-coach")).toHaveCount(0);
  await page.getByRole("button", { name: "Open Simulate →", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Simulate", exact: true })).toBeVisible();
});

test("Studio still routes exhausted Simulate access to Plans", async ({ page, db, e2eUser }) => {
  const cap = meterFor("free", "simulate").cap;
  expect(cap).not.toBeNull();
  // Standard E2E UUID identities intentionally receive unlimited readUsage.
  // This separate verified fictional identity exercises actual stored quotas.
  const user = { id: `studio-limited-${e2eUser.id}`, name: "Fictional capped Studio", email: `studio-limited-${e2eUser.id}@orire.test` };
  await db.user.create({ data: { ...user, emailVerified: new Date() } });
  try {
    await db.usageCounter.create({ data: { userId: user.id, metric: "simulate", period: "lifetime", count: cap! } });
    await addSessionCookie(page.context(), user);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForShell(page);
    await page.getByRole("button", { name: "Upgrade to simulate", exact: true }).click();
    await expect(page.locator(".plan-panel")).toBeVisible();
  } finally {
    await page.context().close();
    await db.user.delete({ where: { id: user.id } });
  }
});
