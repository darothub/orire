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
