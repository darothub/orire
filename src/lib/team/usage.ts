/**
 * orire — team usage aggregation (Phase A: team usage dashboard).
 *
 * Folds per-member `UsageCounter` rows into a team-wide view: this-month and
 * previous-month refine counts per member, team totals, and a short per-month
 * trend. The aggregation core (`buildTeamUsage`) and the month helpers are pure
 * so the ranking, totals, and date math are unit-tested without a DB.
 */

import { prisma } from "@/lib/db/prisma";
import { currentMonth } from "@/lib/entitlement/entitlement";

/** How many trailing months the dashboard summarises (inclusive of current). */
export const USAGE_WINDOW = 3;

export interface UsageMemberInput {
  userId: string;
  name: string | null;
  email: string | null;
}

export interface UsageCounterRow {
  userId: string;
  month: string;
  refinesUsed: number;
}

export interface TeamUsageMember {
  userId: string;
  name: string | null;
  email: string | null;
  thisMonth: number;
  prevMonth: number;
  /** Total refines across the whole window (for secondary ranking + sparklines). */
  windowTotal: number;
  /** Per-window-month counts, aligned to `months` (oldest → newest). */
  monthly: number[];
}

export interface MonthTotal {
  month: string;
  total: number;
}

export interface TeamUsage {
  /** Current month key ("YYYY-MM"). */
  month: string;
  /** Previous month key ("YYYY-MM"). */
  prevMonth: string;
  /** Window month keys, oldest → newest. */
  months: string[];
  /** Members ranked by this-month usage (desc), then window total, then name. */
  members: TeamUsageMember[];
  totalThisMonth: number;
  totalPrevMonth: number;
  /** Team-wide total per window month, oldest → newest. */
  monthlyTotals: MonthTotal[];
}

/** Build the last `count` month keys (oldest → newest), inclusive of `now`. */
export function monthWindow(count: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    out.push(currentMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return out;
}

/** Format a "YYYY-MM" key as a short label ("Oct 2025"). Pure + null-safe. */
export function formatMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return key;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Signed count delta for "this vs previous month" labels. Pure. */
export function usageDelta(current: number, previous: number): string {
  const d = current - previous;
  if (d === 0) return "no change";
  return `${d > 0 ? "+" : "−"}${Math.abs(d)}`;
}

/** Escape a single CSV field (quote when it contains a comma, quote, or newline). */
function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Render a team usage view as CSV (member rows + a team total row). Pure. */
export function usageToCsv(usage: TeamUsage): string {
  const header = ["Member", "Email", ...usage.months.map(formatMonthLabel), "Window total"];
  const lines = [header.map(csvField).join(",")];
  for (const m of usage.members) {
    lines.push(
      [
        m.name ?? "",
        m.email ?? "",
        ...m.monthly.map((n) => String(n)),
        String(m.windowTotal),
      ]
        .map(csvField)
        .join(","),
    );
  }
  lines.push(
    [
      "Team total",
      "",
      ...usage.monthlyTotals.map((t) => String(t.total)),
      String(usage.monthlyTotals.reduce((s, t) => s + t.total, 0)),
    ]
      .map(csvField)
      .join(","),
  );
  return lines.join("\n");
}

/** Pure aggregation: fold counter rows into a per-member + team-total view. */
export function buildTeamUsage(
  members: UsageMemberInput[],
  counters: UsageCounterRow[],
  months: string[],
): TeamUsage {
  const month = months[months.length - 1] ?? currentMonth();
  const prevMonth = months.length > 1 ? months[months.length - 2] : month;

  const byKey = new Map<string, number>();
  for (const c of counters) byKey.set(`${c.userId}|${c.month}`, c.refinesUsed);
  const get = (userId: string, m: string) => byKey.get(`${userId}|${m}`) ?? 0;

  const rows: TeamUsageMember[] = members.map((m) => ({
    userId: m.userId,
    name: m.name,
    email: m.email,
    thisMonth: get(m.userId, month),
    prevMonth: get(m.userId, prevMonth),
    windowTotal: months.reduce((s, mm) => s + get(m.userId, mm), 0),
    monthly: months.map((mm) => get(m.userId, mm)),
  }));
  rows.sort(
    (a, b) =>
      b.thisMonth - a.thisMonth ||
      b.windowTotal - a.windowTotal ||
      (a.name ?? a.email ?? a.userId).localeCompare(b.name ?? b.email ?? b.userId),
  );

  const monthlyTotals: MonthTotal[] = months.map((mm) => ({
    month: mm,
    total: members.reduce((s, m) => s + get(m.userId, mm), 0),
  }));

  return {
    month,
    prevMonth,
    months,
    members: rows,
    totalThisMonth: rows.reduce((s, m) => s + m.thisMonth, 0),
    totalPrevMonth: rows.reduce((s, m) => s + m.prevMonth, 0),
    monthlyTotals,
  };
}

/** DB wrapper: aggregate the window's usage for every member of a team. */
export async function getTeamUsage(teamId: string, now: Date = new Date()): Promise<TeamUsage> {
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  const inputs: UsageMemberInput[] = members.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
  }));
  const months = monthWindow(USAGE_WINDOW, now);
  const counters = inputs.length
    ? await prisma.usageCounter.findMany({
        where: { userId: { in: inputs.map((i) => i.userId) }, month: { in: months } },
        select: { userId: true, month: true, refinesUsed: true },
      })
    : [];
  return buildTeamUsage(inputs, counters, months);
}
