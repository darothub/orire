import { describe, expect, it } from "vitest";
import { validateApplicationInput, validateApplicationStatus } from "./applicationSave";

describe("applicationSave", () => {
  it("requires a company and defaults/clamps the rest", () => {
    expect(validateApplicationInput({ company: "" })).toBeNull();
    expect(validateApplicationInput({})).toBeNull();
    const ok = validateApplicationInput({ company: "  Stripe  ", role: " Backend ", status: "bogus", link: " ", notes: "x" });
    expect(ok).toEqual({ company: "Stripe", role: "Backend", status: "saved", link: null, notes: "x", documentId: null });
    expect(validateApplicationInput({ company: "Monzo", status: "interview" })?.status).toBe("interview");
  });
  it("validates status transitions", () => {
    expect(validateApplicationStatus("offer")).toBe("offer");
    expect(validateApplicationStatus("nope")).toBeNull();
  });
});
