/**
 * orire — pure billing-summary helpers (Phase B polish).
 *
 * These turn the raw `BillingStatus` fields (Stripe subscription `status`,
 * period-end date, and team seat context) into the short, human lines the
 * PlanPanel renders. Keeping them pure makes the owner-vs-member and
 * renewal/past-due logic unit-testable without React or Stripe.
 */

import type { PlanId } from "@/lib/plan/plan";

export interface SubscriptionLine {
  text: string;
  tone: "ok" | "warn";
}

export interface TeamBillingLike {
  onTeam: boolean;
  isOwner: boolean;
  name: string | null;
  plan: PlanId;
  seatsUsed: number;
  seatLimit: number;
}

export interface BillingLike {
  status: string | null;
  renewsAt: string | null;
  hasSubscription: boolean;
  team: TeamBillingLike | null;
}

/** Format an ISO date as a short, locale-stable label (e.g. "Jun 3, 2025"). */
export function formatBillingDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The subscription state line. Returns null when there is nothing meaningful to
 * show (no status on record). Active/trialing read as a renewal; past_due and
 * canceled read as warnings even after the plan has been dropped to free.
 */
export function subscriptionLine(b: BillingLike): SubscriptionLine | null {
  if (!b.status) return null;
  const date = formatBillingDate(b.renewsAt);
  switch (b.status) {
    case "active":
      return { text: date ? `Renews ${date}` : "Active subscription", tone: "ok" };
    case "trialing":
      return { text: date ? `Trial ends ${date}` : "On trial", tone: "ok" };
    case "past_due":
    case "unpaid":
      return { text: "Payment past due — update your card in the billing portal.", tone: "warn" };
    case "incomplete":
    case "incomplete_expired":
      return { text: "Payment didn’t complete — try subscribing again.", tone: "warn" };
    case "canceled":
      return { text: date ? `Access ends ${date}` : "Subscription canceled.", tone: "warn" };
    default:
      return { text: date ? `${titleCase(b.status)} · ${date}` : titleCase(b.status), tone: "warn" };
  }
}

/**
 * True when the signed-in user's paid capability comes from a team they do NOT
 * own — i.e. billing is their owner's responsibility, not theirs. Free teams
 * don't count (nothing is being paid for).
 */
export function isTeamProvided(team: TeamBillingLike | null): boolean {
  return Boolean(team && team.onTeam && !team.isOwner && team.plan !== "free");
}

/** Short note explaining that a seated member's access is billed by the team. */
export function teamProvidedNote(team: TeamBillingLike | null): string | null {
  if (!isTeamProvided(team)) return null;
  const name = team?.name?.trim() || "your team";
  return `Your ${team?.plan} access is provided by ${name}. Billing is managed by the team owner.`;
}

/** Seat-usage label when the user is on a team (owner or member). */
export function seatLine(team: TeamBillingLike | null): string | null {
  if (!team || !team.onTeam) return null;
  const name = team.name?.trim() || "your team";
  return `${team.seatsUsed}/${team.seatLimit} seats used in ${name}`;
}
