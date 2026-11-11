import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = { id: string; email: string; tokenHash: string; expiresAt: Date };
const rows: Row[] = [];

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    magicLinkToken: {
      deleteMany: async ({ where }: { where: { email: string } }) => {
        for (let i = rows.length - 1; i >= 0; i--) if (rows[i].email === where.email) rows.splice(i, 1);
      },
      create: async ({ data }: { data: Omit<Row, "id"> }) => {
        rows.push({ id: String(rows.length + 1), ...data });
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        rows.find((r) => r.tokenHash === where.tokenHash) ?? null,
      delete: async ({ where }: { where: { id: string } }) => {
        const i = rows.findIndex((r) => r.id === where.id);
        if (i >= 0) rows.splice(i, 1);
      },
    },
  },
}));

import { MAGIC_TOKEN_TTL_MS, consumeMagicLinkToken, createMagicLinkToken } from "./magic";

describe("magic link tokens", () => {
  beforeEach(() => {
    rows.length = 0;
  });

  it("stores only a hash and consumes once", async () => {
    const raw = await createMagicLinkToken("a@b.co");
    expect(rows[0].tokenHash).not.toBe(raw);
    expect(await consumeMagicLinkToken(raw)).toBe("a@b.co");
    expect(await consumeMagicLinkToken(raw)).toBeNull();
  });

  it("keeps one live link per email", async () => {
    const first = await createMagicLinkToken("a@b.co");
    const second = await createMagicLinkToken("a@b.co");
    expect(await consumeMagicLinkToken(first)).toBeNull();
    expect(await consumeMagicLinkToken(second)).toBe("a@b.co");
  });

  it("rejects expired and empty tokens", async () => {
    const raw = await createMagicLinkToken("a@b.co");
    rows[0].expiresAt = new Date(Date.now() - 1);
    expect(await consumeMagicLinkToken(raw)).toBeNull();
    expect(await consumeMagicLinkToken("")).toBeNull();
    expect(MAGIC_TOKEN_TTL_MS).toBe(15 * 60 * 1000);
  });
});
