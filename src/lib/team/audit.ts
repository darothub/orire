/**
 * orire — team audit log (Phase B3e).
 *
 * Append-only record of team management actions (renames, role changes,
 * ownership transfers, invites/revokes, joins, removals, leaves). Writes are
 * best-effort: a failure to record audit must never break the underlying
 * management operation, so `recordAudit` swallows its own errors.
 *
 * `auditSentence` is a pure formatter (no DB) so the UI stays dumb and the
 * phrasing is unit-tested.
 */

import { prisma } from "@/lib/db/prisma";

export type TeamAuditAction =
  | "team.created"
  | "team.renamed"
  | "member.invited"
  | "invite.revoked"
  | "member.joined"
  | "member.removed"
  | "member.left"
  | "role.changed"
  | "ownership.transferred";

export interface TeamAuditDTO {
  id: string;
  action: TeamAuditAction;
  actorName: string;
  targetName: string | null;
  detail: string | null;
  summary: string;
  at: string;
}

export interface AuditFields {
  action: string;
  actorName: string;
  targetName: string | null;
  detail: string | null;
}

/** Render a human-readable sentence for one audit entry. Pure + testable. */
export function auditSentence(e: AuditFields): string {
  const actor = e.actorName || "Someone";
  const target = e.targetName || "a member";
  switch (e.action) {
    case "team.created":
      return `${actor} created the team${e.detail ? ` “${e.detail}”` : ""}.`;
    case "team.renamed":
      return `${actor} renamed the team${e.detail ? ` (${e.detail})` : ""}.`;
    case "member.invited":
      return `${actor} invited ${target}.`;
    case "invite.revoked":
      return `${actor} revoked the invite for ${target}.`;
    case "member.joined":
      return `${actor} joined the team.`;
    case "member.removed":
      return `${actor} removed ${target}.`;
    case "member.left":
      return `${actor} left the team.`;
    case "role.changed":
      return `${actor} changed ${target}’s role${e.detail ? ` (${e.detail}).` : "."}`;
    case "ownership.transferred":
      return `${actor} transferred ownership to ${target}.`;
    default:
      return `${actor} performed an action.`;
  }
}

async function userLabel(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  return u?.name || u?.email || null;
}

/**
 * Record an audit entry. Resolves the actor's display name (and the target's,
 * when a `targetId` is given and no `targetName` override is supplied). Never
 * throws — audit is observability, not a gate.
 */
export async function recordAudit(input: {
  teamId: string;
  action: TeamAuditAction;
  actorId: string;
  targetId?: string | null;
  targetName?: string | null;
  detail?: string | null;
}): Promise<void> {
  try {
    const actorName = await userLabel(input.actorId);
    let targetName = input.targetName ?? null;
    if (!targetName && input.targetId) targetName = await userLabel(input.targetId);
    await prisma.teamAudit.create({
      data: {
        teamId: input.teamId,
        action: input.action,
        actorId: input.actorId,
        actorName,
        targetId: input.targetId ?? null,
        targetName,
        detail: input.detail ?? null,
      },
    });
  } catch (err) {
    console.warn("recordAudit failed", err);
  }
}

/** Most-recent-first audit entries for a team. */
export async function listTeamAudit(teamId: string, limit = 30): Promise<TeamAuditDTO[]> {
  const rows = await prisma.teamAudit.findMany({
    where: { teamId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => {
    const actorName = r.actorName || "Someone";
    const targetName = r.targetName;
    return {
      id: r.id,
      action: r.action as TeamAuditAction,
      actorName,
      targetName,
      detail: r.detail,
      summary: auditSentence({ action: r.action, actorName, targetName, detail: r.detail }),
      at: r.createdAt.toISOString(),
    };
  });
}
