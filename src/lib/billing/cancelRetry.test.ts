import { describe, it, expect } from "vitest";
import { cancelSubscriptionWithRetry } from "./stripe";

describe("cancelSubscriptionWithRetry", () => {
  it("succeeds on the first attempt", async () => {
    let calls = 0;
    const res = await cancelSubscriptionWithRetry("sub_1", {
      delaysMs: [0, 0],
      cancelFn: async () => { calls++; },
    });
    expect(res).toEqual({ ok: true, attempts: 1 });
    expect(calls).toBe(1);
  });

  it("retries transient failures then succeeds", async () => {
    let calls = 0;
    const res = await cancelSubscriptionWithRetry("sub_1", {
      attempts: 3,
      delaysMs: [0, 0],
      cancelFn: async () => {
        calls++;
        if (calls < 3) throw new Error("transient");
      },
    });
    expect(res.ok).toBe(true);
    expect(res.attempts).toBe(3);
    expect(calls).toBe(3);
  });

  it("reports failure with the last error after exhausting attempts", async () => {
    let calls = 0;
    const res = await cancelSubscriptionWithRetry("sub_1", {
      attempts: 3,
      delaysMs: [0, 0],
      cancelFn: async () => { calls++; throw new Error("stripe down"); },
    });
    expect(res.ok).toBe(false);
    expect(res.attempts).toBe(3);
    expect(res.error).toBe("stripe down");
    expect(calls).toBe(3);
  });
});
