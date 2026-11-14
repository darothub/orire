import { describe, expect, it } from "vitest";
import { utcDay } from "./budgetPeriod";
describe("OCC per-day budget key", () => {
  it("uses UTC across offsets", () => {
    expect(utcDay(new Date("2026-11-14T23:30:00-01:00"))).toBe("2026-11-15");
    expect(utcDay(new Date("2026-11-14T23:59:00Z"))).toBe("2026-11-14");
  });
});
