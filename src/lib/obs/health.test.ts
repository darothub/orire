import { describe, expect, it } from "vitest";
import { runHealthChecks } from "./health";

const at = () => new Date("2026-10-06T00:00:00.000Z");

describe("runHealthChecks", () => {
  it("reports ok when DB, providers, and Stripe are all healthy", async () => {
    const res = await runHealthChecks({
      pingDb: async () => 3,
      providersConfigured: () => ["openai", "anthropic"],
      stripeConfigured: () => true,
      now: at,
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe("ok");
    expect(res.checks.db).toEqual({ ok: true, latencyMs: 3 });
    expect(res.checks.providers).toEqual({ ok: true, configured: ["openai", "anthropic"] });
    expect(res.checks.stripe.configured).toBe(true);
    expect(res.time).toBe("2026-10-06T00:00:00.000Z");
  });

  it("degrades (but stays up) when no provider keys are configured", async () => {
    const res = await runHealthChecks({
      pingDb: async () => 1,
      providersConfigured: () => [],
      stripeConfigured: () => true,
      now: at,
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe("degraded");
    expect(res.checks.providers.ok).toBe(false);
  });

  it("degrades when Stripe is not configured", async () => {
    const res = await runHealthChecks({
      pingDb: async () => 1,
      providersConfigured: () => ["openai"],
      stripeConfigured: () => false,
      now: at,
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe("degraded");
  });

  it("is down (not ok) when the DB ping rejects, capturing the error", async () => {
    const res = await runHealthChecks({
      pingDb: async () => {
        throw new Error("connection refused");
      },
      providersConfigured: () => ["openai"],
      stripeConfigured: () => true,
      now: at,
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe("down");
    expect(res.checks.db.ok).toBe(false);
    expect(res.checks.db.error).toBe("connection refused");
  });

  it("falls back to a generic DB error for non-Error throws", async () => {
    const res = await runHealthChecks({
      pingDb: async () => {
        throw "boom";
      },
      providersConfigured: () => [],
      stripeConfigured: () => false,
      now: at,
    });
    expect(res.checks.db.error).toBe("Database unreachable.");
    expect(res.status).toBe("down");
  });
});
