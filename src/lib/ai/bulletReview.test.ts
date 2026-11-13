import { describe, it, expect } from "vitest";
import { parseBulletReview, groundSuggestion, numbersIn, buildBulletReviewPrompt, sanitizeAdvice } from "./bulletReview";

describe("parseBulletReview", () => {
  it("parses a well-formed review", () => {
    const r = parseBulletReview(
      JSON.stringify({ verdict: "weak", issues: [{ type: "weak-verb", message: "Weak opener." }], suggestion: "Led the migration." }),
    );
    expect(r.verdict).toBe("weak");
    expect(r.issues).toHaveLength(1);
    expect(r.suggestion).toBe("Led the migration.");
  });

  it("clamps an unknown verdict to ok and drops blank issues", () => {
    const r = parseBulletReview(JSON.stringify({ verdict: "terrible", issues: [{ message: "" }, { type: "x", message: "real" }] }));
    expect(r.verdict).toBe("ok");
    expect(r.issues).toEqual([{ type: "x", message: "real" }]);
    expect(r.suggestion).toBe("");
  });
});

describe("groundSuggestion (fact-grounding guard)", () => {
  it("keeps a suggestion that introduces no new number", () => {
    expect(groundSuggestion("Improved checkout reliability", "Rebuilt checkout, improving reliability")).toBe(
      "Rebuilt checkout, improving reliability",
    );
  });

  it("drops a suggestion that invents a metric not in the original", () => {
    expect(groundSuggestion("Improved checkout reliability", "Improved checkout reliability by 40%")).toBe("");
  });

  it("keeps a reused number from the original", () => {
    expect(groundSuggestion("Cut costs 30% last year", "Drove a 30% cost reduction")).toBe("Drove a 30% cost reduction");
  });

  it("numbersIn extracts digit tokens", () => {
    expect(numbersIn("Saved $120k and cut 30% over 2 years")).toEqual(["120", "30", "2"]);
  });
});

describe("advice-aware prompt", () => {
  it("tells the model to apply the shown advice and use placeholders, not invented numbers", () => {
    const p = buildBulletReviewPrompt("Managed team", undefined, [{ label: "No metric", hint: "Quantify the impact." }]);
    expect(p).toContain("No metric: Quantify the impact.");
    expect(p).toContain("MUST be a non-empty rewrite");
    expect(p).toContain("[X%]");
  });
  it("omits the advice block when there is none", () => {
    expect(buildBulletReviewPrompt("Led team")).not.toContain("advice");
  });
  it("sanitizes untrusted advice", () => {
    expect(sanitizeAdvice("x")).toEqual([]);
    expect(sanitizeAdvice([{ label: "A", hint: "b" }, 5, {}])).toEqual([{ label: "A", hint: "b" }]);
  });
});
