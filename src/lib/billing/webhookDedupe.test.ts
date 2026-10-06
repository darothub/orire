import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const del = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    processedWebhookEvent: {
      create: (...args: unknown[]) => create(...args),
      delete: (...args: unknown[]) => del(...args),
    },
  },
}));

vi.mock("@/lib/obs/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { claimWebhookEvent, releaseWebhookEvent } from "./webhookDedupe";

/** Shape Prisma's unique-constraint error for the duplicate path. */
function uniqueViolation() {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

afterEach(() => {
  create.mockReset();
  del.mockReset();
});

describe("claimWebhookEvent", () => {
  it("claims a fresh event id", async () => {
    create.mockResolvedValueOnce({ id: "evt_1" });
    const res = await claimWebhookEvent("evt_1", "customer.subscription.updated");
    expect(res.claimed).toBe(true);
    expect(create).toHaveBeenCalledWith({
      data: { id: "evt_1", type: "customer.subscription.updated" },
    });
  });

  it("treats a unique-constraint collision as a duplicate (no throw)", async () => {
    create.mockRejectedValueOnce(uniqueViolation());
    const res = await claimWebhookEvent("evt_1", "checkout.session.completed");
    expect(res.claimed).toBe(false);
  });

  it("re-throws unexpected DB errors so the route can 500 and Stripe retries", async () => {
    create.mockRejectedValueOnce(new Error("connection refused"));
    await expect(claimWebhookEvent("evt_2", "x")).rejects.toThrow("connection refused");
  });
});

describe("releaseWebhookEvent", () => {
  it("deletes the claim so a failed event can be retried", async () => {
    del.mockResolvedValueOnce({ id: "evt_1" });
    await releaseWebhookEvent("evt_1");
    expect(del).toHaveBeenCalledWith({ where: { id: "evt_1" } });
  });

  it("swallows delete errors (row may already be gone)", async () => {
    del.mockRejectedValueOnce(new Error("not found"));
    await expect(releaseWebhookEvent("evt_1")).resolves.toBeUndefined();
  });
});
