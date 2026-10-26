import { test, expect, signIn, waitForShell } from "./fixtures";

// Parallel cases must never adopt another test's saved CV or delete its user.
for (const candidate of ["Isolated Candidate Alpha", "Isolated Candidate Beta"]) {
  test(`shared fixtures isolate session, storage and cloud CV for ${candidate}`, async ({ appPage, db, e2eUser }) => {
    const session = await appPage.request.get("/api/auth/session");
    expect((await session.json()).user.id).toBe(e2eUser.id);
    expect(await db.document.count({ where: { userId: e2eUser.id } })).toBe(0);
    expect(await appPage.evaluate(() => localStorage.getItem("orire-onboarded"))).toBe("1");
    await expect(appPage.getByRole("dialog", { name: "Getting started tour" })).toBeHidden();
    const rail = appPage.getByRole("navigation", { name: "Workspaces" });
    await rail.getByRole("button", { name: "Edit", exact: true }).click();
    const name = appPage.getByText("Full name").locator("..").locator("input");
    await expect(name).toHaveValue("Ada Okonkwo");
    await name.fill(candidate);
    await expect.poll(async () => {
      const doc = await db.document.findFirst({ where: { userId: e2eUser.id } });
      return (doc?.data as { basics?: { fullName?: string } } | undefined)?.basics?.fullName;
    }).toBe(candidate);
    await appPage.reload({ waitUntil: "domcontentloaded" });
    await waitForShell(appPage);
    await rail.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(name).toHaveValue(candidate);
    await expect(appPage.getByRole("dialog", { name: "Getting started tour" })).toBeHidden();
  });
}

test("shared onboarding setup applies to additional context pages", async ({ context }) => {
  const page = await context.newPage();
  await signIn(page);
  await page.goto("/");
  await waitForShell(page);
  expect(await page.evaluate(() => localStorage.getItem("orire-onboarded"))).toBe("1");
  await expect(page.getByRole("dialog", { name: "Getting started tour" })).toBeHidden();
});
