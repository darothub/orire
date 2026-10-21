import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const del = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    lifecycleEmail: {
      create: (...args: unknown[]) => create(...args),
      delete: (...args: unknown[]) => del(...args),
    },
  },
}));

vi.mock("@/lib/obs/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { claimLifecycleEmail, releaseLifecycleEmail } from "./lifecycleEmailDedupe";

/** Shape Prisma's unique-constraint error for the duplicate path. */
function uniqueViolation() {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

afterEach(() => {
  create.mockReset();
  del.mockReset();
});

describe("claimLifecycleEmail", () => {
  it("claims a fresh (userId, kind) nudge", async () => {
    create.mockResolvedValueOnce({ id: "le_1" });
    const res = await claimLifecycleEmail("u1", "activation_24h");
    expect(res.claimed).toBe(true);
    expect(create).toHaveBeenCalledWith({ data: { userId: "u1", kind: "activation_24h" } });
  });

  it("treats a unique-constraint collision as already sent (no throw)", async () => {
    create.mockRejectedValueOnce(uniqueViolation());
    const res = await claimLifecycleEmail("u1", "activation_24h");
    expect(res.claimed).toBe(false);
  });

  it("re-throws unexpected DB errors so the cron run fails loudly", async () => {
    create.mockRejectedValueOnce(new Error("connection refused"));
    await expect(claimLifecycleEmail("u1", "activation_24h")).rejects.toThrow("connection refused");
  });
});

describe("releaseLifecycleEmail", () => {
  it("deletes the claim so a failed send can be retried", async () => {
    del.mockResolvedValueOnce({ id: "le_1" });
    await releaseLifecycleEmail("u1", "activation_24h");
    expect(del).toHaveBeenCalledWith({ where: { userId_kind: { userId: "u1", kind: "activation_24h" } } });
  });

  it("swallows delete errors (row may already be gone)", async () => {
    del.mockRejectedValueOnce(new Error("not found"));
    await expect(releaseLifecycleEmail("u1", "activation_24h")).resolves.toBeUndefined();
  });
});
