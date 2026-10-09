import { describe, expect, it } from "vitest";
import { hasMeasurable, numbersGrounded, numbersIn, parseEvidenceBullet, type EvidenceInput } from "./evidence";

const base: EvidenceInput = {
  role: "Ops Lead",
  company: "Acme",
  action: "reworked onboarding",
  scale: "200 clients",
  result: "from 10 days to 6",
  timeframe: "6 months",
};

describe("evidence helper", () => {
  it("extracts numbers and strips commas", () => {
    expect(numbersIn("Saved £1,200 and 3.5 hrs")).toEqual(["1200", "3.5"]);
  });
  it("accepts a draft using only supplied numbers", () => {
    expect(numbersGrounded("Cut onboarding from 10 to 6 days for 200 clients", base)).toBe(true);
  });
  it("rejects invented numbers", () => {
    expect(numbersGrounded("Cut onboarding time by 40% for 200 clients", base)).toBe(false);
  });
  it("detects measurable bullets", () => {
    expect(hasMeasurable("Grew revenue 20%")).toBe(true);
    expect(hasMeasurable("Responsible for onboarding")).toBe(false);
  });
  it("parses fenced JSON and rejects junk", () => {
    expect(parseEvidenceBullet('```json\n{"bullet":"Did x"}\n```')).toBe("Did x");
    expect(parseEvidenceBullet("nope")).toBeNull();
  });
});
