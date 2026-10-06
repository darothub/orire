import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The landing page is intentionally always-dark, but its scrim shares the
 * `.auth-scrim` class, which flips to a near-white wash under the light app
 * theme. Without a dark override the white landing copy becomes invisible in
 * light mode. This guards the override so a CSS refactor can't silently
 * reintroduce the regression.
 */
describe("landing scrim light-theme override", () => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

  it("keeps the landing scrim dark under the light theme", () => {
    expect(css).toMatch(/html\[data-theme="light"\]\s+\.landing-scrim\s*\{[^}]*rgba\(5,\s*7,\s*11/);
  });

  it("still applies the light wash to the generic auth scrim", () => {
    expect(css).toMatch(/html\[data-theme="light"\]\s+\.auth-scrim\s*\{/);
  });
});
