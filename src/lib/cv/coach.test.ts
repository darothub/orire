import { describe, it, expect } from "vitest";
import { analyzeBullet, coachWarningCount } from "./coach";

const ids = (text: string) => analyzeBullet(text).map((f) => f.id).sort();

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
