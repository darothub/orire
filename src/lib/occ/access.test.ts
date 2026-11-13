import { describe, expect, it } from "vitest";
import { canAccessOcc, occFeatureEnabled } from "./access";

describe("OCC feature access", () => {
  it("is off by default and only recognizes explicit true", () => {
    expect(occFeatureEnabled(undefined)).toBe(false);
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

  it("allows only Career with the feature enabled", () => {
    expect(canAccessOcc(null, true)).toBe(false);
    expect(canAccessOcc("free", true)).toBe(false);
    expect(canAccessOcc("pro", true)).toBe(false);
    expect(canAccessOcc("career", true)).toBe(true);
  });
});
