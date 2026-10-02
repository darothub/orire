/**
 * orire — team/seat policy (Phase B3, pure & deterministic).
 *
 * These predicates decide who may own a team, how many seats remain, and what
 * a member's *effective* plan is once team membership is taken into account.
 * They are side-effect free so the enforcement path can rely on unit-tested
 * behaviour; the DB-touching wrappers live in `team.ts`.
 */

import { PLAN_ORDER, type PlanId } from "@/lib/plan/plan";

export type TeamRole = "owner" | "admin" | "member";

/** Only a user on the Teams plan personally can create/own a team. */
export function canOwnTeam(personalPlan: PlanId): boolean {
  return personalPlan === "teams";
}

/** Owners and admins can manage seats/invites; plain members cannot. */
export function canManageTeam(role: TeamRole): boolean {
  return role === "owner" || role === "admin";
}

/** Roles a member can be assigned to via promote/demote (never "owner"). */
export const ASSIGNABLE_ROLES: TeamRole[] = ["admin", "member"];

export function isAssignableRole(role: string): role is "admin" | "member" {
  return role === "admin" || role === "member";
}

/**
 * Only the owner may change roles. Validates a single promote/demote:
 *  - the actor must be the team owner;
 *  - the owner's own seat can't be re-roled (there is exactly one owner);
 *  - the target must not currently be the owner;
 *  - the new role must be an assignable role (admin|member);
 *  - a no-op (target already has `newRole`) is rejected so the UI only offers
 *    real changes.
 */
export function canSetMemberRole(
  actorRole: TeamRole,
  targetRole: TeamRole,
  newRole: string,
): boolean {
  if (actorRole !== "owner") return false;
  if (targetRole === "owner") return false;
  if (!isAssignableRole(newRole)) return false;
  return newRole !== targetRole;
}

/**
 * Only the current owner may hand the team to another seated member. The target
 * must be a different, non-owner member of the same team. After a transfer the
 * old owner becomes an admin (handled in the DB op), so the team always has
 * exactly one owner.
 */
export function canTransferOwnership(actorRole: TeamRole, targetRole: TeamRole): boolean {
  return actorRole === "owner" && targetRole !== "owner";
}

/** Owners and admins can rename the team; plain members cannot. */
export function canRenameTeam(role: TeamRole): boolean {
  return canManageTeam(role);
}

/**
 * Anyone except the owner can leave outright. The owner must either transfer
 * ownership first (then leave) or delete the team, so a team is never orphaned.
 */
export function canLeaveTeam(role: TeamRole): boolean {
  return role !== "owner";
}

/** Validate a proposed team name; returns a trimmed name or an error string. */
export function validateTeamName(name: string): { ok: true; name: string } | { ok: false; error: string } {
  const clean = name.trim();
  if (clean.length < 2) return { ok: false, error: "Give your team a name (2+ characters)." };
  if (clean.length > 60) return { ok: false, error: "Team names are at most 60 characters." };
  return { ok: true, name: clean };
}

/**
 * Seats left on a team. Pending (unaccepted, unexpired) invites are reserved so
 * a team can't over-commit past its seat limit before invitees accept.
 */
export function seatsAvailable(seatLimit: number, memberCount: number, pendingInvites: number): number {
  return Math.max(0, seatLimit - memberCount - pendingInvites);
}

export function hasSeatFor(seatLimit: number, memberCount: number, pendingInvites: number): boolean {
  return seatsAvailable(seatLimit, memberCount, pendingInvites) > 0;
}

/** Rank a plan by its position in PLAN_ORDER (free lowest, teams highest). */
export function planRank(plan: PlanId): number {
  const i = PLAN_ORDER.indexOf(plan);
  return i < 0 ? 0 : i;
}

/**
 * A member's effective plan is the stronger of their personal plan and the
 * plan of the team they belong to (if any). This is what the refine gate reads
 * so a Free user on someone's Teams gets Teams capability while seated.
 */
export function effectivePlan(personalPlan: PlanId, teamPlan: PlanId | null): PlanId {
  if (!teamPlan) return personalPlan;
  return planRank(teamPlan) >= planRank(personalPlan) ? teamPlan : personalPlan;
}

/** Whether an invite row is still redeemable (not accepted, not expired). */
export function inviteIsLive(invite: { acceptedAt: Date | null; expiresAt: Date }, now: Date = new Date()): boolean {
  return invite.acceptedAt === null && invite.expiresAt.getTime() > now.getTime();
}

/** Normalise an email for case-insensitive comparison/storage. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
