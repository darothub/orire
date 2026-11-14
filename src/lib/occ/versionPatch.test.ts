import { describe, expect, it } from "vitest";
import { blankCV } from "@/lib/cv/schema";
import { patchCvField, readCvField, parseCvField } from "./versionPatch";

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
});
