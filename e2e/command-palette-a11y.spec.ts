import { test, expect } from "./fixtures";

test.use({ colorScheme: "dark", reducedMotion: "reduce" });

for (const viewport of [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
]) {
  test("command palette contains keyboard focus and restores its opener " + viewport.name, async ({ appPage }) => {
    await appPage.setViewportSize({ width: viewport.width, height: viewport.height });
    await appPage.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    const errors: string[] = [];
    appPage.on("pageerror", (error) => errors.push(error.message));
    const opener = appPage.locator(".cmdk-hint-btn");
    await opener.focus();
    await appPage.keyboard.press("Control+k");
    const dialog = appPage.getByRole("dialog", { name: "Command palette" });
    const search = dialog.getByPlaceholder("Search workspaces, templates, actions…");
    await expect(search).toBeFocused();
    await expect(appPage.locator("main#main-content")).toHaveAttribute("inert", "");
    await expect(appPage.locator(".app-bar")).toHaveAttribute("inert", "");
    await expect(dialog).not.toHaveAttribute("inert", "");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS("transform", "none");
    await appPage.screenshot({
      path: "test-results/ux92-command-palette/AFTER-actual-" + viewport.name + ".png",
      animations: "disabled",
    });

    // Reverse Tab wraps from the search field to the final command; forward
    // Tab then wraps back. Searching changes that set of controls dynamically.
    const lastCommand = dialog.getByRole("button").last();
    await appPage.keyboard.press("Shift+Tab");
    await expect(lastCommand).toBeFocused();
    await appPage.keyboard.press("Tab");
    await expect(search).toBeFocused();
    await search.fill("no matching command 92837");
    await expect(dialog.getByRole("button")).toHaveCount(0);
    await appPage.keyboard.press("Tab");
    await expect(search).toBeFocused();
    await appPage.keyboard.press("Shift+Tab");
    await expect(search).toBeFocused();
    await search.fill("");
    await appPage.keyboard.press("Tab");
    await expect(dialog.getByRole("button").first()).toBeFocused();
    // Escape must work on an actual command, not just on the search input.
    await appPage.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(appPage.locator("main#main-content")).not.toHaveAttribute("inert", "");
    await expect(appPage.locator(".app-bar")).not.toHaveAttribute("inert", "");

    // Reopening and toggling closed must also release isolation and restore
    // focus; it must not leave stale state from the exit animation.
    await appPage.keyboard.press("Control+k");
    await expect(search).toBeFocused();
    await appPage.keyboard.press("Control+k");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(appPage.locator("main#main-content")).not.toHaveAttribute("inert", "");
    expect(errors).toEqual([]);
  });
}
