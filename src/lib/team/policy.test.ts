import { describe, it, expect } from "vitest";
import {
  canOwnTeam,
  canManageTeam,
  seatsAvailable,
  hasSeatFor,
  planRank,
  effectivePlan,
  inviteIsLive,
  normalizeEmail,
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
});
