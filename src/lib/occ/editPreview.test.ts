import { describe, expect, it } from "vitest";
import { previewCvEdit } from "./editPreview";
describe("OCC local CV draft preview", () => {
  it("changes only a selected exact passage in the draft", () => {
    const original = "Summary: Backend engineer. Built services with Java and Kafka. Skills: Java";
    const result = previewCvEdit(original, { before: "Built services with Java and Kafka.", after: "Built Java services integrating Kafka." });
    expect(result).toBe("Summary: Backend engineer. Built Java services integrating Kafka. Skills: Java");
    expect(original).toContain("Built services with Java and Kafka.");
  });
  it("rejects ambiguous replacements and missing evidence", () => {
    expect(previewCvEdit("1234567890 1234567890", { before: "1234567890", after: "replacement" })).toBeNull();
    expect(previewCvEdit("Existing CV", { before: "Unknown text 123", after: "replacement" })).toBeNull();
  });
});
