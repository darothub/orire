import { describe, expect, it } from "vitest";
import { readDecision, updateDecision } from "./decisions";
describe("OCC recommendation decisions", () => {
  it("allows only known decisions", () => {
    expect(readDecision("accepted")).toBe("accepted");
    expect(readDecision("approved-and-send")).toBeNull();
  });
  it("modifies only the selected decision", () => {
    expect(updateDecision([{ requirement: "A", decision: "pending" }, { requirement: "B" }], 0, "rejected"))
      .toEqual([{ requirement: "A", decision: "rejected" }, { requirement: "B" }]);
  });
  it("rejects indexes outside the stored recommendation list", () => {
    expect(updateDecision([{ requirement: "A" }], 4, "accepted")).toBeNull();
  });
});
