import { describe, it, expect } from "vitest";
import { editDistance, findSpellingIssues, isKnownOrDerived } from "./spellcheck";
import { SPELL_DICTIONARY } from "./spellDictionary";

describe("editDistance", () => {
  it("computes small-string Levenshtein", () => {
    expect(editDistance("paymants", "payments")).toBe(1);
    expect(editDistance("a", "a")).toBe(0);
  });
});

describe("isKnownOrDerived", () => {
  it("accepts plurals of known stems", () => {
    expect(isKnownOrDerived("millions")).toBe(true);
    expect(isKnownOrDerived("payments")).toBe(true);
  });

  it("accepts -ive / -able forms of known stems", () => {
    expect(isKnownOrDerived("responsive")).toBe(true);
    expect(isKnownOrDerived("maintainable")).toBe(true);
  });

  it("rejects real typos", () => {
    expect(isKnownOrDerived("paymants")).toBe(false);
    expect(isKnownOrDerived("recieve")).toBe(false);
  });
});

describe("findSpellingIssues", () => {
  it("returns empty for dictionary-clean text", () => {
    expect(
      findSpellingIssues("Led migration of billing cutting failed payments", { skipFirst: true }),
    ).toEqual([]);
  });

  it("does not flag the Android CV bullets that previously false-positived", () => {
    const a =
      "Delivered delivered delivered led end-to-end delivery of native Android features for a real-time communication platform used by millions, owning design, implementation, testing, release and production support";
    const b =
      "Built responsive, maintainable Android interfaces using Kotlin, Jetpack Compose, Coroutines and modern architecture patterns";
    expect(findSpellingIssues(a, { skipFirst: true }).map((i) => i.word.toLowerCase())).not.toContain(
      "millions",
    );
    expect(findSpellingIssues(b, { skipFirst: true }).map((i) => i.word.toLowerCase())).toEqual([]);
  });

  it("suggests a near-miss body word (distance 1 only)", () => {
    const issues = findSpellingIssues("Led migration cutting failed paymants", { skipFirst: true });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.suggest).toBe("payments");
  });

  it("does not distance-2-correct real adjectives into shorter stems", () => {
    // Even if somehow not in lexicon, dist 2 must not fire.
    const issues = findSpellingIssues("Built something xyzresponsive here", { skipFirst: true });
    expect(issues.every((i) => i.dist === 1)).toBe(true);
    expect(issues.every((i) => i.suggest !== "response" || i.word.toLowerCase() !== "responsive")).toBe(
      true,
    );
  });

  it("skips the first token when skipFirst is true", () => {
    const issues = findSpellingIssues("Comtributed payments successfully", { skipFirst: true });
    expect(issues.every((i) => i.word.toLowerCase() !== "comtributed")).toBe(true);
  });

  it("skips ALL-CAPS and short tokens", () => {
    expect(findSpellingIssues("Used AWS and SSO for MFA", { skipFirst: false })).toEqual([]);
  });

  it("dictionary contains core tech allowlist terms and no intentional misspellings", () => {
    for (const w of ["react", "typescript", "kubernetes", "stripe", "postgres"]) {
      expect(SPELL_DICTIONARY.has(w)).toBe(true);
    }
    expect(SPELL_DICTIONARY.has("maintainance")).toBe(false);
    expect(SPELL_DICTIONARY.has("recieve")).toBe(false);
  });
});
