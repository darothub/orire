/**
 * Shared focus helpers for the auth dialog (signup / sign-in overlay).
 * Kept pure so unit tests don't need a full jsdom store stack.
 */

/** Elements a keyboard user can Tab to inside the auth card. */
export const AUTH_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/** Prefer the primary form control over chrome (Back / Close / theme). */
export const AUTH_INITIAL_FOCUS_SELECTOR = [
  "[data-auth-initial-focus]",
  'input:not([type="hidden"]):not([disabled])',
  "button.auth-oauth-btn:not([disabled])",
  "button.auth-submit:not([disabled])",
].join(", ");

export function listFocusable(container: ParentNode): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(AUTH_FOCUSABLE_SELECTOR)).filter(
    (el) => {
      if (el.getAttribute("aria-hidden") === "true") return false;
      // Honour programmatic-only targets (card shell, inactive tabs, eye toggle).
      if (el.getAttribute("tabindex") === "-1") return false;
      // offsetParent is null for display:none; fixed/sticky still have a box.
      const style = typeof window !== "undefined" ? window.getComputedStyle(el) : null;
      if (style && (style.visibility === "hidden" || style.display === "none")) return false;
      return true;
    },
  );
}

/** Best first focus target when the dialog opens. */
export function pickInitialFocus(container: HTMLElement): HTMLElement {
  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>(AUTH_INITIAL_FOCUS_SELECTOR),
  ).filter((el) => {
    if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return false;
    if (el.getAttribute("tabindex") === "-1") return false;
    return true;
  });
  if (candidates[0]) return candidates[0];
  const items = listFocusable(container);
  // Skip pure chrome if something else exists further in.
  const chrome = /auth-back|auth-close|auth-theme/;
  const content = items.find((el) => !chrome.test(el.className));
  return content ?? items[0] ?? container;
}
