import { describe, expect, it } from "vitest";
import { formatBillingDate, subscriptionLine } from "./summary";

describe("formatBillingDate", () => {
  it("formats an ISO date", () => {
    expect(formatBillingDate("2025-06-03T00:00:00.000Z")).toMatch(/Jun 3, 2025/);
  });
  it("returns null for null/invalid", () => {
    expect(formatBillingDate(null)).toBeNull();
    expect(formatBillingDate("not-a-date")).toBeNull();
  });
});

describe("subscriptionLine", () => {
  const base = { hasSubscription: true };
  it("reads active as a renewal", () => {
    const l = subscriptionLine({ ...base, status: "active", renewsAt: "2025-06-03T00:00:00Z" });
    expect(l).toEqual({ text: expect.stringMatching(/^Renews Jun 3, 2025$/), tone: "ok" });
  });
  it("reads trialing as a trial end", () => {
    const l = subscriptionLine({ ...base, status: "trialing", renewsAt: "2025-06-03T00:00:00Z" });
    expect(l?.tone).toBe("ok");
    expect(l?.text).toMatch(/^Trial ends/);
  });
  it("warns on past_due", () => {
    const l = subscriptionLine({ ...base, status: "past_due", renewsAt: null });
    expect(l?.tone).toBe("warn");
    expect(l?.text).toMatch(/past due/i);
  });
  it("warns on canceled with an access-ends date", () => {
    const l = subscriptionLine({ ...base, status: "canceled", renewsAt: "2025-06-03T00:00:00Z" });
    expect(l?.tone).toBe("warn");
    expect(l?.text).toMatch(/^Access ends/);
  });
  it("returns null when no status is on record", () => {
    expect(subscriptionLine({ ...base, status: null, renewsAt: null })).toBeNull();
  });
  it("title-cases an unknown status", () => {
    const l = subscriptionLine({ ...base, status: "paused", renewsAt: null });
    expect(l).toEqual({ text: "Paused", tone: "warn" });
  });
});
