import { describe, expect, it } from "vitest";
import { canAccessOcc, occBetaEmailAllowed, occFeatureEnabled } from "./access";

describe("OCC feature access", () => {
  it("is off by default and only recognizes explicit true", () => {
    expect(occFeatureEnabled("")).toBe(false);
    expect(occFeatureEnabled("false")).toBe(false);
    expect(occFeatureEnabled("1")).toBe(false);
    expect(occFeatureEnabled("TRUE")).toBe(false);
    expect(occFeatureEnabled("true")).toBe(true);
  });

  it("rejects all plans when disabled", () => {
    expect(canAccessOcc(null, false)).toBe(false);
    expect(canAccessOcc("free", false)).toBe(false);
    expect(canAccessOcc("pro", false)).toBe(false);
    expect(canAccessOcc("career", false)).toBe(false);
  });

  it("denies beta access without an explicit server-side allowlist", () => {
    expect(occBetaEmailAllowed("darotudeen+career@gmail.com", undefined)).toBe(false);
    expect(occBetaEmailAllowed(null, "darotudeen+career@gmail.com")).toBe(false);
    expect(occBetaEmailAllowed("other@example.com", "darotudeen+career@gmail.com")).toBe(false);
    expect(occBetaEmailAllowed("darotudeen+career@gmail.com.evil", "darotudeen+career@gmail.com")).toBe(false);
    expect(occBetaEmailAllowed("darotudeen+career@gmail.com", "darotudeen+career@gmail.com")).toBe(true);
    expect(occBetaEmailAllowed(" DAROTUDEEN+CAREER@GMAIL.COM ", " darotudeen+career@gmail.com, another@example.com ")).toBe(true);
  });

  it("allows only Career with the feature enabled", () => {
    expect(canAccessOcc(null, true)).toBe(false);
    expect(canAccessOcc("free", true)).toBe(false);
    expect(canAccessOcc("pro", true)).toBe(false);
    expect(canAccessOcc("career", true)).toBe(true);
  });
});
