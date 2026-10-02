import { describe, expect, it } from "vitest";
import { renderTeamDigest } from "./digest";
import { buildTeamUsage, type UsageCounterRow, type UsageMemberInput } from "./usage";

const months = ["2025-08", "2025-09", "2025-10"];
const members: UsageMemberInput[] = [
  { userId: "u1", name: "Ada", email: "ada@x.io" },
  { userId: "u2", name: "Bo", email: "bo@x.io" },
  { userId: "u3", name: null, email: "cy@x.io" },
];
const counters: UsageCounterRow[] = [
  { userId: "u1", month: "2025-10", refinesUsed: 4 },
  { userId: "u1", month: "2025-09", refinesUsed: 2 },
  { userId: "u2", month: "2025-10", refinesUsed: 9 },
  { userId: "u2", month: "2025-08", refinesUsed: 1 },
];

describe("renderTeamDigest", () => {
  const usage = buildTeamUsage(members, counters, months);
  const email = renderTeamDigest(usage, "Acme");

  it("builds a subject with team name and month", () => {
    expect(email.subject).toBe("orire · Acme usage — Oct 2025");
  });
  it("summarises this-month total and delta in the text body", () => {
    expect(email.text).toContain("Refines this month: 13 (+11 vs Sep 2025)");
  });
  it("lists the per-month trend", () => {
    expect(email.text).toContain("Aug 2025: 1");
    expect(email.text).toContain("Sep 2025: 2");
    expect(email.text).toContain("Oct 2025: 13");
  });
  it("ranks members and omits those with no window usage", () => {
    expect(email.text).toContain("1. Bo — 9 this month, 10 in window");
    expect(email.text).toContain("2. Ada — 4 this month, 6 in window");
    expect(email.text).not.toContain("cy@x.io"); // u3 has zero usage
  });
  it("produces HTML referencing the totals", () => {
    expect(email.html).toContain("<strong>13</strong>");
    expect(email.html).toContain("Acme");
  });

  it("handles a team with no usage", () => {
    const empty = renderTeamDigest(buildTeamUsage(members, [], months), "Quiet");
    expect(empty.text).toContain("No refine activity in this window yet.");
    expect(empty.html).toContain("No refine activity in this window yet.");
  });

  it("escapes HTML in names and team titles", () => {
    const u = buildTeamUsage(
      [{ userId: "x", name: "<b>Eve</b>", email: "e@x" }],
      [{ userId: "x", month: "2025-10", refinesUsed: 2 }],
      months,
    );
    const email2 = renderTeamDigest(u, "A & B <Team>");
    expect(email2.html).toContain("&lt;b&gt;Eve&lt;/b&gt;");
    expect(email2.html).toContain("A &amp; B &lt;Team&gt;");
    expect(email2.html).not.toContain("<b>Eve</b>");
  });

  it("caps the member list at the top 5", () => {
    const many: UsageMemberInput[] = Array.from({ length: 8 }, (_, i) => ({
      userId: `m${i}`,
      name: `M${i}`,
      email: `m${i}@x`,
    }));
    const manyCounters: UsageCounterRow[] = many.map((m, i) => ({
      userId: m.userId,
      month: "2025-10",
      refinesUsed: i + 1,
    }));
    const email3 = renderTeamDigest(buildTeamUsage(many, manyCounters, months), "Big");
    expect((email3.text.match(/this month,/g) ?? []).length).toBe(5);
  });
});
