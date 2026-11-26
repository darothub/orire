import { describe, expect, it } from "vitest";
import { v4EmailAllowed, v4Enabled } from "./flags";

describe("v4 release switches", () => {
  it("is off unless the switch is exactly true", () => {
    expect(v4Enabled(undefined)).toBe(false);
    expect(v4Enabled("")).toBe(false);
    expect(v4Enabled("1")).toBe(false);
    expect(v4Enabled("TRUE")).toBe(false);
    expect(v4Enabled("true")).toBe(true);
  });
  it("lets everyone in when no beta list is set", () => {
    expect(v4EmailAllowed("a@b.co", undefined)).toBe(true);
    expect(v4EmailAllowed(null, " , ")).toBe(true);
  });
  it("limits access to the listed emails, case-insensitively, when a list is set", () => {
    const list = "Darot@Example.com, tester@example.com";
    expect(v4EmailAllowed("darot@example.com", list)).toBe(true);
    expect(v4EmailAllowed("other@example.com", list)).toBe(false);
    expect(v4EmailAllowed(undefined, list)).toBe(false);
  });
});
