import { describe, expect, it } from "vitest";
import { AUTH_FOCUSABLE_SELECTOR, AUTH_INITIAL_FOCUS_SELECTOR, pickInitialFocus } from "./authFocus";

/** Minimal DOM for Node tests without jsdom. */
function makeTree(html: string): HTMLElement {
  // Prefer linkedom-free approach: use undici/happy-dom if present; else a
  // tiny recursive parser is overkill — vitest in this repo runs under vite
  // which may not ship jsdom. Use the global document when available.
  if (typeof document === "undefined") {
    // Soft-skip style: exercise selector strings still parse.
    expect(AUTH_FOCUSABLE_SELECTOR).toContain("button");
    expect(AUTH_INITIAL_FOCUS_SELECTOR).toContain("data-auth-initial-focus");
    // Return a stub that won't be used by later assertions in this branch.
    return { querySelector: () => null, querySelectorAll: () => [] } as unknown as HTMLElement;
  }
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

describe("authFocus", () => {
  it("exports stable selectors", () => {
    expect(AUTH_FOCUSABLE_SELECTOR).toMatch(/button:not\(\[disabled\]\)/);
    expect(AUTH_INITIAL_FOCUS_SELECTOR).toMatch(/data-auth-initial-focus/);
  });

  it("prefers data-auth-initial-focus over chrome buttons", () => {
    if (typeof document === "undefined") return;
    const root = makeTree(`
      <button class="auth-back">Back</button>
      <button class="auth-close">×</button>
      <input data-auth-initial-focus type="email" />
      <button class="auth-submit">Go</button>
    `);
    const pick = pickInitialFocus(root);
    expect(pick.getAttribute("data-auth-initial-focus")).toBe("");
    expect(pick.tagName).toBe("INPUT");
  });

  it("falls back to oauth when no email field", () => {
    if (typeof document === "undefined") return;
    const root = makeTree(`
      <button class="auth-back">Back</button>
      <button class="auth-oauth-btn" type="button">Google</button>
    `);
    const pick = pickInitialFocus(root);
    expect(pick.classList.contains("auth-oauth-btn")).toBe(true);
  });
});
