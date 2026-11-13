/**
 * Lazy English spellchecker (Hunspell via nspell). It is the deterministic
 * gate for the coach's typo flag: a word the dictionary knows is never called
 * a typo, so no hand-kept word list has to grow with the language. Words the
 * dictionary doesn't know (names, tech terms) are left to the AI review.
 */

import type NSpell from "nspell";

type Checker = Pick<NSpell, "correct">;

let checker: Checker | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

export function subscribeSpell(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export const spellReady = (): boolean => checker !== null;

/** Install a checker directly (tests, or a server-side caller). */
export function setSpellChecker(c: Checker | null): void {
  checker = c;
  notify();
}

/** Fetch the dictionary once; safe to call repeatedly. Failure leaves the typo flag off. */
export function loadSpell(): Promise<void> {
  if (checker || typeof window === "undefined") return Promise.resolve();
  loading ??= (async () => {
    try {
      const [{ default: nspell }, aff, dic] = await Promise.all([
        import("nspell"),
        fetch("/dict/en.aff").then((r) => (r.ok ? r.text() : Promise.reject(new Error("aff")))),
        fetch("/dict/en.dic").then((r) => (r.ok ? r.text() : Promise.reject(new Error("dic")))),
      ]);
      checker = nspell(aff, dic);
      notify();
    } catch {
      loading = null;
    }
  })();
  return loading;
}

/** true/false once loaded; null while unknown (callers must not flag on null). */
export function isEnglishWord(word: string): boolean | null {
  if (!checker) return null;
  const w = word.toLowerCase();
  return checker.correct(w) || checker.correct(w.charAt(0).toUpperCase() + w.slice(1));
}
