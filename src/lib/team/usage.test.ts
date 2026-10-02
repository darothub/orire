import { describe, expect, it } from "vitest";
import {
  buildTeamUsage,
  formatMonthLabel,
  monthWindow,
  usageDelta,
  type UsageCounterRow,
  type UsageMemberInput,
} from "./usage";

describe("monthWindow", () => {
  it("returns `count` month keys oldest→newest inclusive of now", () => {
    const now = new Date(Date.UTC(2025, 9, 15)); // Oct 2025
    expect(monthWindow(3, now)).toEqual(["2025-08", "2025-09", "2025-10"]);
  });
  it("rolls across a year boundary", () => {
    const now = new Date(Date.UTC(2025, 0, 10)); // Jan 2025
    expect(monthWindow(3, now)).toEqual(["2024-11", "2024-12", "2025-01"]);
  });
});

describe("formatMonthLabel", () => {
  it("formats a key", () => {
    expect(formatMonthLabel("2025-10")).toBe("Oct 2025");
  });
  it("passes through a malformed key", () => {
    expect(formatMonthLabel("nope")).toBe("nope");
    expect(formatMonthLabel("2025-13")).toBe("2025-13");
  });
});

describe("usageDelta", () => {
  it("signs increases and decreases, and reports no change", () => {
    expect(usageDelta(5, 2)).toBe("+3");
    expect(usageDelta(2, 5)).toBe("−3");
    expect(usageDelta(4, 4)).toBe("no change");
  });
});

const members: UsageMemberInput[] = [
  { userId: "u1", name: "Ada", email: "ada@x.io" },
  { userId: "u2", name: "Bo", email: "bo@x.io" },
  { userId: "u3", name: null, email: "cy@x.io" },
];
const months = ["2025-08", "2025-09", "2025-10"];
const counters: UsageCounterRow[] = [
  { userId: "u1", month: "2025-10", refinesUsed: 4 },
  { userId: "u1", month: "2025-09", refinesUsed: 2 },
  { userId: "u2", month: "2025-10", refinesUsed: 9 },
  { userId: "u2", month: "2025-08", refinesUsed: 1 },
  // u3 has no usage
];

describe("buildTeamUsage", () => {
  const u = buildTeamUsage(members, counters, months);

  it("ranks members by this-month usage desc", () => {
    expect(u.members.map((m) => m.userId)).toEqual(["u2", "u1", "u3"]);
  });
  it("computes per-member this/prev month and window totals", () => {
    const ada = u.members.find((m) => m.userId === "u1")!;
    expect(ada.thisMonth).toBe(4);
    expect(ada.prevMonth).toBe(2);
    expect(ada.windowTotal).toBe(6);
  });
  it("zeroes members with no counters", () => {
    const cy = u.members.find((m) => m.userId === "u3")!;
    expect(cy.thisMonth).toBe(0);
    expect(cy.windowTotal).toBe(0);
  });
  it("sums team totals for current and previous month", () => {
    expect(u.totalThisMonth).toBe(13); // 9 + 4
    expect(u.totalPrevMonth).toBe(2); // only u1 in Sep
  });
  it("builds a team-wide per-month trend", () => {
    expect(u.monthlyTotals).toEqual([
      { month: "2025-08", total: 1 },
      { month: "2025-09", total: 2 },
      { month: "2025-10", total: 13 },
    ]);
  });
  it("exposes current and previous month keys", () => {
    expect(u.month).toBe("2025-10");
    expect(u.prevMonth).toBe("2025-09");
  });

  it("tie-breaks equal usage by window total then name", () => {
    const tie = buildTeamUsage(
      [
        { userId: "a", name: "Zed", email: "z@x" },
        { userId: "b", name: "Amy", email: "a@x" },
      ],
      [
        { userId: "a", month: "2025-10", refinesUsed: 3 },
        { userId: "b", month: "2025-10", refinesUsed: 3 },
        { userId: "a", month: "2025-09", refinesUsed: 5 },
      ],
      months,
    );
    // a has larger window total → ranks first despite later name
    expect(tie.members.map((m) => m.userId)).toEqual(["a", "b"]);
  });

  it("handles an empty team", () => {
    const empty = buildTeamUsage([], [], months);
    expect(empty.members).toEqual([]);
    expect(empty.totalThisMonth).toBe(0);
    expect(empty.monthlyTotals.every((m) => m.total === 0)).toBe(true);
  });
});
