import { describe, expect, it } from "vitest";
import { canAccessOcc, occBetaEmailAllowed, occFeatureEnabled, occIsolatedE2eFixtureAllowed } from "./access";

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

  it("allows synthetic E2E fixtures ONLY in a disposable loopback database", () => {
    const id = "e2e-user-123e4567-e89b-42d3-a456-426614174000";
    const email = `${id}@orire.test`;
    const local = "postgresql://postgres:postgres@localhost:5432/orire_e2e_ci?schema=public";
    expect(occIsolatedE2eFixtureAllowed(id, email, "1", local)).toBe(true);
    expect(occIsolatedE2eFixtureAllowed(id, email, undefined, local)).toBe(false);
    expect(occIsolatedE2eFixtureAllowed(id, email, "0", local)).toBe(false);
    expect(occIsolatedE2eFixtureAllowed(id, email, "1", "postgresql://prod.example.com/orire_e2e_ci")).toBe(false);
    expect(occIsolatedE2eFixtureAllowed(id, email, "1", "postgresql://localhost:5432/orire_production")).toBe(false);
    expect(occIsolatedE2eFixtureAllowed(id, "darotudeen+career@gmail.com", "1", local)).toBe(false);
    expect(occIsolatedE2eFixtureAllowed("other-user", "other-user@orire.test", "1", local)).toBe(false);
  });

  it("allows only Career with the feature enabled", () => {
    expect(canAccessOcc(null, true)).toBe(false);
    expect(canAccessOcc("free", true)).toBe(false);
    expect(canAccessOcc("pro", true)).toBe(false);
    expect(canAccessOcc("career", true)).toBe(true);
  });
});
