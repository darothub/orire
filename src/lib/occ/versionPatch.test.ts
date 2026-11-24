import { describe, expect, it } from "vitest";
import { blankCV } from "@/lib/cv/schema";
import { patchCvField, readCvField, parseCvField, cvFieldChoices } from "./versionPatch";

describe("OCC structured CV version patch", () => {
  const cv = blankCV();
  cv.basics.summary = "Built backend payments and authentication services for clients.";
  cv.experience[0].id = "exp-1";
  cv.experience[0].highlights = ["Delivered Kafka-based authentication workflows for clients."];
  it("replaces exactly one field without mutating the source CV", () => {
    const next = patchCvField(cv, { kind: "experience", itemId: "exp-1", index: 0 },
      cv.experience[0].highlights[0], "Delivered Kafka-based authentication workflows for payment clients.");
    expect(next?.experience[0].highlights[0]).toContain("payment clients");
    expect(cv.experience[0].highlights[0]).toContain("for clients.");
  });
  it("fails closed for stale content or an unknown field", () => {
    expect(patchCvField(cv, { kind: "summary" }, "Old summary", "This has sufficient characters.")).toBeNull();
    expect(readCvField(cv, { kind: "experience", itemId: "not-found", index: 0 })).toBeNull();
    expect(parseCvField({ kind: "experience", itemId: "x", index: -1 })).toBeNull();
  });
  it("lists only non-empty summary and bullets as revisable choices", () => {
    const choices = cvFieldChoices(cv);
    expect(choices.map(c => c.field.kind)).toEqual(["summary", "experience"]);
    expect(choices[0]).toMatchObject({ field: { kind: "summary" }, text: cv.basics.summary });
    expect(choices[1]).toMatchObject({ field: { kind: "experience", itemId: "exp-1", index: 0 } });
    // A blank summary drops out; each choice round-trips through readCvField.
    const blanked = { ...cv, basics: { ...cv.basics, summary: "   " } };
    const blankedChoices = cvFieldChoices(blanked);
    expect(blankedChoices.some(c => c.field.kind === "summary")).toBe(false);
    for (const choice of blankedChoices) expect(readCvField(blanked, choice.field)).toBe(choice.text);
  });
});
