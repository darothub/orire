import { describe, it, expect, beforeAll } from "vitest";
import { coachStepCutoff, signCoachToken, verifyCoachToken } from "./coachToken";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret";
});

describe("coach token", () => {
  it("verifies for the same user and returns the run id", () => {
    const { token, runId } = signCoachToken("u1");
    expect(verifyCoachToken(token, "u1")).toEqual({ ok: true, runId });
  });
  it("rejects another user, tampering, expiry and junk", () => {
    const { token } = signCoachToken("u1", 1000);
    expect(verifyCoachToken(token, "u2", 2000).ok).toBe(false);
    expect(verifyCoachToken(token + "x", "u1", 2000).ok).toBe(false);
    expect(verifyCoachToken(token, "u1", 1000 + 31 * 60_000).ok).toBe(false);
    expect(verifyCoachToken(undefined, "u1").ok).toBe(false);
    expect(verifyCoachToken("a.b", "u1").ok).toBe(false);
  });

  it("sorts run ids below the cutoff only after the token has expired", () => {
    const { runId } = signCoachToken("u1", 1_000_000);
    expect(runId < coachStepCutoff(1_000_000 + 29 * 60_000)).toBe(false);
    expect(runId < coachStepCutoff(1_000_000 + 31 * 60_000)).toBe(true);
  });
});
