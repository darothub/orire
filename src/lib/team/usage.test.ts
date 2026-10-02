import { describe, expect, it } from "vitest";
import {
  buildTeamUsage,
  clampUsageWindow,
  formatMonthLabel,
  monthWindow,
  usageDelta,
  usageToCsv,
  USAGE_WINDOW,
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
  it("supports longer windows", () => {
    const now = new Date(Date.UTC(2025, 9, 15)); // Oct 2025
    expect(monthWindow(6, now)).toHaveLength(6);
    expect(monthWindow(12, now)[0]).toBe("2024-11");
    expect(monthWindow(12, now).at(-1)).toBe("2025-10");
  });
});

describe("clampUsageWindow", () => {
  it("passes through allowed window lengths", () => {
    expect(clampUsageWindow(3)).toBe(3);
    expect(clampUsageWindow(6)).toBe(6);
    expect(clampUsageWindow(12)).toBe(12);
  });
  it("falls back to the default for disallowed values", () => {
    expect(clampUsageWindow(4)).toBe(USAGE_WINDOW);
    expect(clampUsageWindow(0)).toBe(USAGE_WINDOW);
    expect(clampUsageWindow(-1)).toBe(USAGE_WINDOW);
    expect(clampUsageWindow(100)).toBe(USAGE_WINDOW);
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
  it("exposes a per-member monthly series aligned to the window", () => {
    const ada = u.members.find((m) => m.userId === "u1")!;
    expect(ada.monthly).toEqual([0, 2, 4]); // Aug, Sep, Oct
    const bo = u.members.find((m) => m.userId === "u2")!;
    expect(bo.monthly).toEqual([1, 0, 9]);
    const cy = u.members.find((m) => m.userId === "u3")!;
    expect(cy.monthly).toEqual([0, 0, 0]);
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

describe("usageToCsv", () => {
  const u = buildTeamUsage(members, counters, months);
  const csv = usageToCsv(u);
  const lines = csv.split("\n");

  it("writes a header with month labels and a window-total column", () => {
    expect(lines[0]).toBe("Member,Email,Aug 2025,Sep 2025,Oct 2025,Window total");
  });
  it("writes one row per member in ranked order", () => {
    // ranked: u2 (Bo), u1 (Ada), u3 (null name)
    expect(lines[1]).toBe("Bo,bo@x.io,1,0,9,10");
    expect(lines[2]).toBe("Ada,ada@x.io,0,2,4,6");
    expect(lines[3]).toBe(",cy@x.io,0,0,0,0");
  });
  it("appends a team total row", () => {
    expect(lines[4]).toBe("Team total,,1,2,13,16");
  });
  it("quotes fields containing commas or quotes", () => {
    const csv2 = usageToCsv(
      buildTeamUsage(
        [{ userId: "x", name: "Doe, Jane", email: 'a"b@x.io' }],
        [{ userId: "x", month: "2025-10", refinesUsed: 2 }],
        months,
      ),
    );
    expect(csv2.split("\n")[1]).toBe('"Doe, Jane","a""b@x.io",0,0,2,2');
  });
});
