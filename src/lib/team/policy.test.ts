import { describe, it, expect } from "vitest";
import {
  canOwnTeam,
  canManageTeam,
  canRenameTeam,
  canLeaveTeam,
  canTransferOwnership,
  canSetMemberRole,
  isAssignableRole,
  seatsAvailable,
  hasSeatFor,
  planRank,
  effectivePlan,
  inviteIsLive,
  normalizeEmail,
  validateTeamName,
} from "./policy";

describe("team policy", () => {
  it("only the teams plan can own a team", () => {
    expect(canOwnTeam("teams")).toBe(true);
    expect(canOwnTeam("career")).toBe(false);
    expect(canOwnTeam("pro")).toBe(false);
    expect(canOwnTeam("free")).toBe(false);
  });

  it("owners and admins manage; members do not", () => {
    expect(canManageTeam("owner")).toBe(true);
    expect(canManageTeam("admin")).toBe(true);
    expect(canManageTeam("member")).toBe(false);
  });

  it("only the owner may change roles, and only to admin/member", () => {
    // owner can promote/demote non-owners between admin and member
    expect(canSetMemberRole("owner", "member", "admin")).toBe(true);
    expect(canSetMemberRole("owner", "admin", "member")).toBe(true);
    // admins and members can't change roles at all
    expect(canSetMemberRole("admin", "member", "admin")).toBe(false);
    expect(canSetMemberRole("member", "member", "admin")).toBe(false);
    // the owner seat is never re-roled, and nobody is promoted to owner
    expect(canSetMemberRole("owner", "owner", "admin")).toBe(false);
    expect(canSetMemberRole("owner", "member", "owner")).toBe(false);
    // no-ops are rejected
    expect(canSetMemberRole("owner", "admin", "admin")).toBe(false);
    expect(canSetMemberRole("owner", "member", "member")).toBe(false);
    // unknown target roles are rejected
    expect(canSetMemberRole("owner", "member", "superadmin")).toBe(false);
  });

  it("recognises assignable roles", () => {
    expect(isAssignableRole("admin")).toBe(true);
    expect(isAssignableRole("member")).toBe(true);
    expect(isAssignableRole("owner")).toBe(false);
    expect(isAssignableRole("nope")).toBe(false);
  });

  it("counts seats with pending invites reserved", () => {
    expect(seatsAvailable(5, 2, 1)).toBe(2);
    expect(seatsAvailable(5, 5, 0)).toBe(0);
    expect(seatsAvailable(5, 4, 3)).toBe(0); // never negative
    expect(hasSeatFor(5, 2, 1)).toBe(true);
    expect(hasSeatFor(5, 3, 2)).toBe(false);
  });

  it("ranks plans by order", () => {
    expect(planRank("free")).toBeLessThan(planRank("pro"));
    expect(planRank("pro")).toBeLessThan(planRank("career"));
    expect(planRank("career")).toBeLessThan(planRank("teams"));
  });

  it("effective plan is the stronger of personal and team", () => {
    expect(effectivePlan("free", "teams")).toBe("teams");
    expect(effectivePlan("career", "teams")).toBe("teams");
    expect(effectivePlan("free", null)).toBe("free");
    expect(effectivePlan("teams", "teams")).toBe("teams");
    // a personal plan stronger than the team plan wins (defensive)
    expect(effectivePlan("career", "pro")).toBe("career");
  });

  it("invite is live only when unaccepted and unexpired", () => {
    const future = new Date(Date.now() + 60_000);
    const past = new Date(Date.now() - 60_000);
    expect(inviteIsLive({ acceptedAt: null, expiresAt: future })).toBe(true);
    expect(inviteIsLive({ acceptedAt: null, expiresAt: past })).toBe(false);
    expect(inviteIsLive({ acceptedAt: new Date(), expiresAt: future })).toBe(false);
  });

  it("normalizes email", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });

  it("only the owner can transfer ownership, and not to another owner", () => {
    expect(canTransferOwnership("owner", "admin")).toBe(true);
    expect(canTransferOwnership("owner", "member")).toBe(true);
    expect(canTransferOwnership("owner", "owner")).toBe(false);
    expect(canTransferOwnership("admin", "member")).toBe(false);
    expect(canTransferOwnership("member", "member")).toBe(false);
  });

  it("owners and admins can rename; members cannot", () => {
    expect(canRenameTeam("owner")).toBe(true);
    expect(canRenameTeam("admin")).toBe(true);
    expect(canRenameTeam("member")).toBe(false);
  });

  it("anyone but the owner can leave", () => {
    expect(canLeaveTeam("owner")).toBe(false);
    expect(canLeaveTeam("admin")).toBe(true);
    expect(canLeaveTeam("member")).toBe(true);
  });

  it("validates team names", () => {
    expect(validateTeamName("  Acme Coaching ")).toEqual({ ok: true, name: "Acme Coaching" });
    expect(validateTeamName(" a ").ok).toBe(false);
    expect(validateTeamName("x".repeat(61)).ok).toBe(false);
    expect(validateTeamName("x".repeat(60)).ok).toBe(true);
  });
});
