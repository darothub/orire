import { describe, it, expect, afterEach } from "vitest";
import { E2E_USER_ID, e2eBypassEnabled, isE2eBypassUser } from "./bypass";

describe("e2e bypass", () => {
  const prev = process.env.ORIRE_E2E_BYPASS;
  afterEach(() => {
    if (prev === undefined) delete process.env.ORIRE_E2E_BYPASS;
    else process.env.ORIRE_E2E_BYPASS = prev;
  });

  it("is off by default", () => {
    delete process.env.ORIRE_E2E_BYPASS;
    expect(e2eBypassEnabled()).toBe(false);
    expect(isE2eBypassUser(E2E_USER_ID)).toBe(false);
  });

  it("only matches the minted e2e user when enabled", () => {
    process.env.ORIRE_E2E_BYPASS = "1";
    expect(e2eBypassEnabled()).toBe(true);
    expect(isE2eBypassUser(E2E_USER_ID)).toBe(true);
    expect(isE2eBypassUser("someone-else")).toBe(false);
    expect(isE2eBypassUser(null)).toBe(false);
  });
});
