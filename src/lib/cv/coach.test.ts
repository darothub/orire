import { describe, it, expect } from "vitest";
import { analyzeBullet, coachWarningCount, editDistance } from "./coach";

const ids = (text: string) => analyzeBullet(text).map((f) => f.id).sort();
const flag = (text: string, id: string) => analyzeBullet(text).find((f) => f.id === id);

describe("analyzeBullet", () => {
  it("returns no flags for a strong, quantified bullet", () => {
    expect(analyzeBullet("Led migration of billing to Stripe, cutting failed payments 38%.")).toEqual([]);
  });

  it("returns nothing for empty / whitespace", () => {
    expect(analyzeBullet("")).toEqual([]);
    expect(analyzeBullet("   ")).toEqual([]);
  });

  it("flags a weak opener", () => {
    expect(ids("Helped build the onboarding flow for new engineers")).toContain("weak-verb");
  });

  it("flags duty framing, not weak-verb, for 'Responsible for…'", () => {
    const got = ids("Responsible for the team's weekly reporting and planning cadence");
    expect(got).toContain("duty");
    expect(got).not.toContain("weak-verb");
  });

  it("flags a substantive bullet with no metric", () => {
    expect(ids("Rebuilt the search index and improved relevance for users")).toContain("no-metric");
  });

  it("does NOT flag no-metric when a number/percent/currency/x is present", () => {
    expect(ids("Scaled throughput 4x across three regions")).not.toContain("no-metric");
    expect(ids("Saved $120k in annual cloud spend")).not.toContain("no-metric");
    expect(ids("Raised conversion by 12% in one quarter")).not.toContain("no-metric");
  });

  it("does not run content checks on a short fragment", () => {
    // 3 words, no metric — too short to nag about a metric.
    expect(ids("Owned the roadmap")).not.toContain("no-metric");
  });

  it("flags first person", () => {
    expect(ids("I led a team of five to ship the redesign in 2 months")).toContain("first-person");
  });

  it("flags an over-long bullet", () => {
    const long = "Led " + "the cross functional initiative ".repeat(10) + "to completion in 2024";
    expect(ids(long)).toContain("too-long");
  });

  it("ignores leading bullet glyphs when matching the opener", () => {
    expect(ids("• Assisted with quarterly planning across the org")).toContain("weak-verb");
  });
});

describe("opener verb strength + spelling", () => {
  it("flags a misspelled opening verb with the correction", () => {
    const f = flag("Comtributed to everything", "typo");
    expect(f).toBeTruthy();
    expect(f!.suggest).toBe("contributed");
    expect(f!.hint).toContain("Contributed");
  });

  it("flags a real word that isn't a CV action verb as an unusual opener", () => {
    const got = ids("Colonised everything");
    expect(got).toContain("odd-verb");
    expect(got).not.toContain("typo");
  });

  it("accepts a recognized strong action verb", () => {
    expect(ids("Led the platform rebuild")).not.toContain("odd-verb");
    expect(ids("Led the platform rebuild")).not.toContain("typo");
  });

  it("prefers the weak/duty phrase flag over a verb-spelling flag", () => {
    expect(ids("Contributed to the design system")).toContain("weak-verb");
    expect(ids("Contributed to the design system")).not.toContain("odd-verb");
  });

  it("does not analyze hyphenated or short openers", () => {
    expect(ids("Co-led the migration across teams")).not.toContain("odd-verb");
  });
});

describe("editDistance", () => {
  it("computes Levenshtein distance", () => {
    expect(editDistance("comtributed", "contributed")).toBe(1);
    expect(editDistance("led", "led")).toBe(0);
    expect(editDistance("", "abc")).toBe(3);
  });
});

describe("coachWarningCount", () => {
  it("counts only bullets with a warn-level flag", () => {
    const bullets = [
      "Led migration, cutting latency 40%.", // clean
      "Helped build the thing for the team", // weak-verb (warn)
      "Rebuilt the search index for users", // no-metric only (info, not warn)
      "Responsible for reporting across teams", // duty (warn)
    ];
    expect(coachWarningCount(bullets)).toBe(2);
  });
});

describe("optional deepSpell dictionary check", () => {
  it("stays silent on body typos when deepSpell is off (default)", () => {
    const got = analyzeBullet("Led migraton of billing to Stripe, cutting failed payments 38%.");
    expect(got.map((f) => f.id)).not.toContain("spell");
    // opener is fine; may still have no-metric etc. depending on content — body typo alone must not fire
  });

  it("flags a body-word near-miss when deepSpell is on", () => {
    const f = analyzeBullet(
      "Led migration of billing to Stripe, cutting failed paymants 38%.",
      { deepSpell: true },
    ).find((x) => x.id === "spell");
    expect(f).toBeTruthy();
    expect(f!.suggest).toBe("payments");
    expect(f!.hint.toLowerCase()).toContain("paymants");
  });

  it("does not flag known clean body words when deepSpell is on", () => {
    expect(
      analyzeBullet("Led migration of billing to Stripe, cutting failed payments 38%.", {
        deepSpell: true,
      }).map((f) => f.id),
    ).not.toContain("spell");
  });

  it("does not double-flag the opener as spell when typo already covers it", () => {
    // Opener typo path uses id "typo"; deepSpell skips first token.
    const flags = analyzeBullet("Comtributed everything for the team with 3 wins", { deepSpell: true });
    expect(flags.some((f) => f.id === "typo")).toBe(true);
    expect(flags.filter((f) => f.id === "spell" && f.suggest === "contributed")).toHaveLength(0);
  });
});

describe("findSpellingIssues (via deepSpell)", () => {
  it("skips short tokens and ALL-CAPS acronyms", () => {
    const flags = analyzeBullet("Led API rollout for SSO across EU teams in 2 weeks", {
      deepSpell: true,
    });
    expect(flags.map((f) => f.id)).not.toContain("spell");
  });

  it("does not false-positive millions / responsive / maintainable", () => {
    const a = analyzeBullet(
      "Delivered end-to-end delivery of native Android features for a platform used by millions with 2 releases",
      { deepSpell: true },
    );
    const b = analyzeBullet(
      "Built responsive maintainable Android interfaces using Kotlin with 3 screens",
      { deepSpell: true },
    );
    expect(a.map((f) => f.id)).not.toContain("spell");
    expect(b.map((f) => f.id)).not.toContain("spell");
  });
});
