import { describe, it, expect } from "vitest";
import { editDistance, findSpellingIssues } from "./spellcheck";
import { SPELL_DICTIONARY } from "./spellDictionary";

describe("editDistance", () => {
  it("computes small-string Levenshtein", () => {
    expect(editDistance("paymants", "payments")).toBe(1);
    expect(editDistance("a", "a")).toBe(0);
  });
});

describe("findSpellingIssues", () => {
  it("returns empty for dictionary-clean text", () => {
    expect(
      findSpellingIssues("Led migration of billing cutting failed payments", { skipFirst: true }),
    ).toEqual([]);
  });

  it("suggests a near-miss body word", () => {
    const issues = findSpellingIssues("Led migration cutting failed paymants", { skipFirst: true });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.suggest).toBe("payments");
  });

  it("skips the first token when skipFirst is true", () => {
    // "Comtributed" would match contributed, but first token is skipped.
    const issues = findSpellingIssues("Comtributed payments successfully", { skipFirst: true });
    expect(issues.every((i) => i.word.toLowerCase() !== "comtributed")).toBe(true);
  });

  it("skips ALL-CAPS and short tokens", () => {
    expect(findSpellingIssues("Used AWS and SSO for MFA", { skipFirst: false })).toEqual([]);
  });

  it("dictionary contains core tech allowlist terms", () => {
    for (const w of ["react", "typescript", "kubernetes", "stripe", "postgres"]) {
      expect(SPELL_DICTIONARY.has(w)).toBe(true);
    }
  });
});
