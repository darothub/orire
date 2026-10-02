/**
 * orire — team server actions (Phase B3).
 *
 * Thin `"use server"` wrappers the TeamPanel client calls. Each re-derives the
 * caller from the session (never trusts a client-supplied user id) and delegates
 * to the invariant-enforcing helpers in `@/lib/team/team`.
 */

"use server";

import { auth } from "@/lib/auth/auth";
import { getPlanId } from "@/lib/entitlement/entitlement";
import { canOwnTeam } from "@/lib/team/policy";
import { listTeamAudit, type TeamAuditDTO } from "@/lib/team/audit";
import {
  acceptInvite,
  createTeam,
  deleteTeam,
  getTeamContext,
  inviteToTeam,
  leaveTeam,
  removeMember,
  renameTeam,
  revokeInvite,
  setMemberRole,
  transferOwnership,
  type TeamContext,
  type TeamOpResult,
} from "@/lib/team/team";

export interface TeamOverview {
  signedIn: boolean;
  /** True when the caller could create a team (Teams plan, no team yet). */
  canCreate: boolean;
  team: TeamContext | null;
}

const NOT_SIGNED_IN: TeamOpResult = { ok: false, error: "Sign in first." };

export async function teamOverview(): Promise<TeamOverview> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return { signedIn: false, canCreate: false, team: null };
  const [team, personal] = await Promise.all([getTeamContext(userId), getPlanId(userId)]);
  return {
    signedIn: true,
    canCreate: team === null && canOwnTeam(personal),
    team,
  };
}

/** Recent team activity, visible to owners/admins of the caller's team. */
export async function teamAuditAction(): Promise<TeamAuditDTO[]> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return [];
  const team = await getTeamContext(userId);
  if (!team || !team.canManage) return [];
  return listTeamAudit(team.team.id);
}

export async function createTeamAction(name: string): Promise<TeamOpResult> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return NOT_SIGNED_IN;
  return createTeam(userId, name);
}

export async function inviteMemberAction(email: string): Promise<TeamOpResult> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return NOT_SIGNED_IN;
  return inviteToTeam(userId, email);
}

export async function acceptInviteAction(token: string): Promise<TeamOpResult> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return NOT_SIGNED_IN;
  return acceptInvite(userId, session?.user?.email ?? null, token);
}

export async function revokeInviteAction(inviteId: string): Promise<TeamOpResult> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return NOT_SIGNED_IN;
  return revokeInvite(userId, inviteId);
}

export async function removeMemberAction(targetUserId: string): Promise<TeamOpResult> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return NOT_SIGNED_IN;
  return removeMember(userId, targetUserId);
}

export async function setMemberRoleAction(
  targetUserId: string,
  role: string,
): Promise<TeamOpResult> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return NOT_SIGNED_IN;
  return setMemberRole(userId, targetUserId, role);
}

export async function leaveTeamAction(): Promise<TeamOpResult> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return NOT_SIGNED_IN;
  return leaveTeam(userId);
}

export async function renameTeamAction(name: string): Promise<TeamOpResult> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return NOT_SIGNED_IN;
  return renameTeam(userId, name);
}

export async function transferOwnershipAction(targetUserId: string): Promise<TeamOpResult> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return NOT_SIGNED_IN;
  return transferOwnership(userId, targetUserId);
}

export async function deleteTeamAction(): Promise<TeamOpResult> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return NOT_SIGNED_IN;
  return deleteTeam(userId);
}
