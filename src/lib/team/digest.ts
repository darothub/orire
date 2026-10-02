/**
 * orire — monthly team usage email digest.
 *
 * `renderTeamDigest` turns an aggregated `TeamUsage` into a plain-text + HTML
 * email body and is pure (unit-tested without a DB or SMTP). `sendTeamDigest`
 * resolves the team's managers (owner/admins) as recipients and dispatches via
 * the shared mailer; `runAllTeamDigests` is the entry point a scheduler/cron
 * hits to fan the digest out across every team.
 */

import { prisma } from "@/lib/db/prisma";
import { sendMail, type MailResult } from "@/lib/mail/mailer";
import {
  formatMonthLabel,
  getTeamUsage,
  usageDelta,
  type TeamUsage,
} from "@/lib/team/usage";

export interface DigestEmail {
  subject: string;
  text: string;
  html: string;
}

/** How many ranked members to spell out in the digest body. */
const DIGEST_TOP_N = 5;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render a team usage view into an email body. Pure. */
export function renderTeamDigest(usage: TeamUsage, teamName: string): DigestEmail {
  const monthLabel = formatMonthLabel(usage.month);
  const subject = `orire · ${teamName} usage — ${monthLabel}`;
  const delta = usageDelta(usage.totalThisMonth, usage.totalPrevMonth);
  const ranked = usage.members.filter((m) => m.windowTotal > 0).slice(0, DIGEST_TOP_N);

  // ---- plain text ----
  const lines: string[] = [];
  lines.push(`${teamName} — usage digest for ${monthLabel}`);
  lines.push("");
  lines.push(
    `Refines this month: ${usage.totalThisMonth} (${delta} vs ${formatMonthLabel(usage.prevMonth)})`,
  );
  lines.push("");
  lines.push(`Last ${usage.months.length} months:`);
  for (const t of usage.monthlyTotals) {
    lines.push(`  ${formatMonthLabel(t.month)}: ${t.total}`);
  }
  lines.push("");
  if (ranked.length === 0) {
    lines.push("No refine activity in this window yet.");
  } else {
    lines.push("Top members:");
    ranked.forEach((m, i) => {
      const who = m.name || m.email || "Member";
      lines.push(`  ${i + 1}. ${who} — ${m.thisMonth} this month, ${m.windowTotal} in window`);
    });
  }
  lines.push("");
  lines.push("— orire");
  const text = lines.join("\n");

  // ---- html ----
  const trendRows = usage.monthlyTotals
    .map(
      (t) =>
        `<tr><td style="padding:2px 12px 2px 0;color:#9aa;">${escapeHtml(
          formatMonthLabel(t.month),
        )}</td><td style="padding:2px 0;font-variant-numeric:tabular-nums;">${t.total}</td></tr>`,
    )
    .join("");
  const memberRows =
    ranked.length === 0
      ? `<tr><td colspan="3" style="padding:6px 0;color:#9aa;">No refine activity in this window yet.</td></tr>`
      : ranked
          .map((m, i) => {
            const who = escapeHtml(m.name || m.email || "Member");
            return `<tr><td style="padding:3px 12px 3px 0;color:#9aa;">${i + 1}.</td><td style="padding:3px 12px 3px 0;">${who}</td><td style="padding:3px 0;font-variant-numeric:tabular-nums;">${m.thisMonth} / ${m.windowTotal}</td></tr>`;
          })
          .join("");
  const html = `<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;color:#e7e7ee;background:#0b0b12;padding:24px;border-radius:12px;">
  <h2 style="margin:0 0 4px;font-size:17px;">${escapeHtml(teamName)}</h2>
  <p style="margin:0 0 16px;color:#9aa;font-size:13px;">Usage digest for ${escapeHtml(monthLabel)}</p>
  <p style="margin:0 0 16px;font-size:15px;">Refines this month: <strong>${usage.totalThisMonth}</strong> <span style="color:#9aa;">(${escapeHtml(delta)} vs ${escapeHtml(formatMonthLabel(usage.prevMonth))})</span></p>
  <h3 style="margin:0 0 6px;font-size:13px;color:#c9c9d6;">Last ${usage.months.length} months</h3>
  <table style="border-collapse:collapse;font-size:13px;margin:0 0 18px;">${trendRows}</table>
  <h3 style="margin:0 0 6px;font-size:13px;color:#c9c9d6;">Top members <span style="color:#9aa;">(this month / window)</span></h3>
  <table style="border-collapse:collapse;font-size:13px;">${memberRows}</table>
  <p style="margin:18px 0 0;color:#777;font-size:11px;">— orire</p>
</div>`;

  return { subject, text, html };
}

export interface DigestSendResult extends MailResult {
  teamId: string;
  recipients: string[];
}

/** Send one team's digest to its owner/admins. */
export async function sendTeamDigest(
  teamId: string,
  window?: number,
  now: Date = new Date(),
): Promise<DigestSendResult> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return { ok: false, delivered: false, error: "Team not found.", teamId, recipients: [] };
  }
  const managers = await prisma.teamMember.findMany({
    where: { teamId, role: { in: ["owner", "admin"] } },
    include: { user: true },
  });
  const recipients = managers
    .map((m) => m.user.email)
    .filter((e): e is string => Boolean(e));
  if (recipients.length === 0) {
    return { ok: false, delivered: false, error: "No manager emails.", teamId, recipients: [] };
  }
  const usage = await getTeamUsage(teamId, window, now);
  const { subject, text, html } = renderTeamDigest(usage, team.name);
  const res = await sendMail({ to: recipients, subject, text, html });
  return { ...res, teamId, recipients };
}

export interface DigestRunSummary {
  teams: number;
  sent: number;
  failed: number;
  results: DigestSendResult[];
}

/** Fan the digest out across every team (scheduler/cron entry point). */
export async function runAllTeamDigests(
  window?: number,
  now: Date = new Date(),
): Promise<DigestRunSummary> {
  const teams = await prisma.team.findMany({ select: { id: true } });
  const results: DigestSendResult[] = [];
  for (const t of teams) {
    results.push(await sendTeamDigest(t.id, window, now));
  }
  return {
    teams: teams.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
