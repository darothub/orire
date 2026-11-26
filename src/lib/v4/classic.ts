/**
 * Whether this browser chose to stay on the current ("classic") Orire.
 * Signed-in people who can use v4 are sent to /app from the home page unless they chose this.
 * Opening any v4 page clears the choice, so it is always one click to go either way.
 */
const KEY = "orire:classic";

export function classicChosen(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setClassicChosen(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the choice just doesn't stick */
  }
}

/** True when the URL asks to stay on classic (`/?classic=1`). */
export const wantsClassic = (search: string): boolean => new URLSearchParams(search).get("classic") === "1";
