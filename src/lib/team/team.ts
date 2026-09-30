/**
 * orire — team/seat operations (Phase B3).
 *
 * DB-touching wrappers over the pure policy in `policy.ts`. A team is owned by
 * a Teams-plan user and grants seated members the Teams capability (premium
 * models without a personal key) via `getEffectivePlanId`, which the refine
 * gate reads instead of the raw personal plan.
 *
 * Invariants enforced here (not just in the schema):
 *  - only a Teams-plan user may create/own a team;
 *  - a user holds at most one seat across all teams;
 *  - members + live invites never exceed the seat limit.
 */

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import type { PlanId } from "@/lib/plan/plan";
import { getPlanId } from "@/lib/entitlement/entitlement";
import {
  canOwnTeam,
  canManageTeam,
  effectivePlan,
  hasSeatFor,
  normalizeEmail,
  seatsAvailable,
  type TeamRole,
} from "@/lib/team/policy";

const INVITE_TTL_DAYS = 14;
const PLAN_IDS = new Set<string>(["free", "pro", "career", "teams"]);

function asPlan(plan: string | null | undefined): PlanId {
  return (plan && PLAN_IDS.has(plan) ? plan : "free") as PlanId;
}

export interface TeamMemberDTO {
  userId: string;
  name: string | null;
  email: string | null;
  role: TeamRole;
  createdAt: string;
}

export interface TeamInviteDTO {
  id: string;
  email: string;
  role: TeamRole;
  token: string;
  createdAt: string;
  expiresAt: string;
}

export interface TeamContext {
  team: { id: string; name: string; plan: PlanId; seatLimit: number };
  role: TeamRole;
  members: TeamMemberDTO[];
  pendingInvites: TeamInviteDTO[];
  seatsLeft: number;
  canManage: boolean;
}

/** The single team a user belongs to (as owner or member), or null. */
async function findMembership(userId: string) {
  return prisma.teamMember.findUnique({ where: { userId } });
}

/** Count members and live (unaccepted, unexpired) invites for seat math. */
async function seatUsage(teamId: string, now: Date = new Date()) {
  const [memberCount, pendingInvites] = await Promise.all([
    prisma.teamMember.count({ where: { teamId } }),
    prisma.teamInvite.count({ where: { teamId, acceptedAt: null, expiresAt: { gt: now } } }),
  ]);
  return { memberCount, pendingInvites };
}

/**
 * A user's effective plan: the stronger of their personal entitlement and the
 * plan of any team they hold a seat on. This is the value the refine gate must
 * read so seated members get their team's capability.
 */
export async function getEffectivePlanId(userId: string): Promise<PlanId> {
  const [personal, membership] = await Promise.all([getPlanId(userId), findMembership(userId)]);
  if (!membership) return personal;
  const team = await prisma.team.findUnique({ where: { id: membership.teamId } });
  return effectivePlan(personal, team ? asPlan(team.plan) : null);
}

/** Full team context for the UI, or null when the user is on no team. */
export async function getTeamContext(userId: string): Promise<TeamContext | null> {
  const membership = await findMembership(userId);
  if (!membership) return null;
  const team = await prisma.team.findUnique({
    where: { id: membership.teamId },
    include: {
      members: { include: { user: true }, orderBy: { createdAt: "asc" } },
      invites: { where: { acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!team) return null;
  const role = membership.role as TeamRole;
  const seatsLeft = seatsAvailable(team.seatLimit, team.members.length, team.invites.length);
  return {
    team: { id: team.id, name: team.name, plan: asPlan(team.plan), seatLimit: team.seatLimit },
    role,
    canManage: canManageTeam(role),
    seatsLeft,
    members: team.members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role as TeamRole,
      createdAt: m.createdAt.toISOString(),
    })),
    pendingInvites: team.invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role as TeamRole,
      token: i.token,
      createdAt: i.createdAt.toISOString(),
      expiresAt: i.expiresAt.toISOString(),
    })),
  };
}

export interface TeamOpResult {
  ok: boolean;
  error?: string;
}

/** Create a team owned by the caller. Requires the Teams personal plan. */
export async function createTeam(userId: string, name: string): Promise<TeamOpResult> {
  const clean = name.trim();
  if (clean.length < 2) return { ok: false, error: "Give your team a name (2+ characters)." };
  const personal = await getPlanId(userId);
  if (!canOwnTeam(personal)) {
    return { ok: false, error: "Creating a team needs the Teams plan. Subscribe to Teams first." };
  }
  if (await findMembership(userId)) {
    return { ok: false, error: "You're already on a team. Leave it before creating a new one." };
  }
  await prisma.team.create({
    data: {
      name: clean,
      ownerId: userId,
      plan: "teams",
      members: { create: { userId, role: "owner" } },
    },
  });
  return { ok: true };
}

/** Invite an email to the caller's team. Owner/admin only; respects seat cap. */
export async function inviteToTeam(userId: string, email: string, role: TeamRole = "member"): Promise<TeamOpResult> {
  const membership = await findMembership(userId);
  if (!membership) return { ok: false, error: "You're not on a team." };
  if (!canManageTeam(membership.role as TeamRole)) {
    return { ok: false, error: "Only owners and admins can invite." };
  }
  const target = normalizeEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) {
    return { ok: false, error: "That doesn't look like a valid email." };
  }
  const team = await prisma.team.findUnique({ where: { id: membership.teamId } });
  if (!team) return { ok: false, error: "Team not found." };

  // Already a member?
  const existingMember = await prisma.teamMember.findFirst({
    where: { teamId: team.id, user: { email: target } },
  });
  if (existingMember) return { ok: false, error: "That person is already on the team." };

  // Existing live invite?
  const existingInvite = await prisma.teamInvite.findFirst({
    where: { teamId: team.id, email: target, acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  if (existingInvite) return { ok: false, error: "There's already a pending invite for that email." };

  const { memberCount, pendingInvites } = await seatUsage(team.id);
  if (!hasSeatFor(team.seatLimit, memberCount, pendingInvites)) {
    return { ok: false, error: `No seats left (${team.seatLimit} max). Remove a member or a pending invite.` };
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.teamInvite.create({
    data: { teamId: team.id, email: target, role, token, invitedById: userId, expiresAt },
  });
  return { ok: true };
}

/** Redeem an invite token, seating the caller. Enforces single-seat + cap. */
export async function acceptInvite(userId: string, userEmail: string | null, token: string): Promise<TeamOpResult> {
  const invite = await prisma.teamInvite.findUnique({ where: { token } });
  if (!invite) return { ok: false, error: "That invite link is invalid." };
  if (invite.acceptedAt) return { ok: false, error: "That invite was already used." };
  if (invite.expiresAt.getTime() <= Date.now()) return { ok: false, error: "That invite has expired." };

  if (await findMembership(userId)) {
    return { ok: false, error: "You're already on a team. Leave it before joining another." };
  }

  const { memberCount, pendingInvites } = await seatUsage(invite.teamId);
  const team = await prisma.team.findUnique({ where: { id: invite.teamId } });
  if (!team) return { ok: false, error: "That team no longer exists." };
  // This invite is itself one of the pending seats, so exclude it from the
  // reserved count when checking whether a seat is free for the accepter.
  if (seatsAvailable(team.seatLimit, memberCount, Math.max(0, pendingInvites - 1)) <= 0) {
    return { ok: false, error: "That team is full." };
  }

  await prisma.$transaction([
    prisma.teamMember.create({ data: { teamId: invite.teamId, userId, role: invite.role } }),
    prisma.teamInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
  ]);
  void userEmail; // reserved: could warn when the invite email differs from the account
  return { ok: true };
}

/** Revoke a pending invite. Owner/admin only. */
export async function revokeInvite(userId: string, inviteId: string): Promise<TeamOpResult> {
  const membership = await findMembership(userId);
  if (!membership || !canManageTeam(membership.role as TeamRole)) {
    return { ok: false, error: "Only owners and admins can revoke invites." };
  }
  const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.teamId !== membership.teamId) return { ok: false, error: "Invite not found." };
  await prisma.teamInvite.delete({ where: { id: inviteId } });
  return { ok: true };
}

/** Remove a seated member. Owner/admin only; the owner seat is protected. */
export async function removeMember(userId: string, targetUserId: string): Promise<TeamOpResult> {
  const membership = await findMembership(userId);
  if (!membership || !canManageTeam(membership.role as TeamRole)) {
    return { ok: false, error: "Only owners and admins can remove members." };
  }
  const target = await prisma.teamMember.findUnique({ where: { userId: targetUserId } });
  if (!target || target.teamId !== membership.teamId) return { ok: false, error: "That person isn't on your team." };
  if (target.role === "owner") return { ok: false, error: "The owner can't be removed." };
  await prisma.teamMember.delete({ where: { userId: targetUserId } });
  return { ok: true };
}

/** Leave the caller's team. The owner must delete the team instead. */
export async function leaveTeam(userId: string): Promise<TeamOpResult> {
  const membership = await findMembership(userId);
  if (!membership) return { ok: false, error: "You're not on a team." };
  if (membership.role === "owner") {
    return { ok: false, error: "Owners can't leave — delete the team instead." };
  }
  await prisma.teamMember.delete({ where: { userId } });
  return { ok: true };
}

/** Delete the caller's owned team (and all seats/invites via cascade). */
export async function deleteTeam(userId: string): Promise<TeamOpResult> {
  const membership = await findMembership(userId);
  if (!membership || membership.role !== "owner") {
    return { ok: false, error: "Only the owner can delete the team." };
  }
  await prisma.team.delete({ where: { id: membership.teamId } });
  return { ok: true };
}
