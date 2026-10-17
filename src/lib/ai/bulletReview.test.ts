import { describe, it, expect } from "vitest";
import { parseBulletReview, groundSuggestion, numbersIn } from "./bulletReview";

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
