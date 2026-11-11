"use server";

import { auth } from "@/lib/auth/auth";
import { requireVerifiedAction } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/prisma";
import { mergeFacts, sanitizeFacts, type Fact } from "@/lib/tailor/facts";
import type { Prisma } from "@prisma/client";

/** The signed-in user's fact ledger, or null when signed out. */
export async function loadFactLedger(): Promise<Fact[] | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { factLedger: true } });
  return sanitizeFacts(user?.factLedger);
}

/**
 * Save the ledger. The server merges with what it already holds so a stale
 * device cannot erase facts or resurrect deleted ones.
 */
export async function saveFactLedger(input: Fact[]): Promise<{ ok: true } | { ok: false; reason: string }> {
  const gate = await requireVerifiedAction("save your verified facts");
  if (!gate.ok) return { ok: false, reason: gate.reason };
  const existing = await prisma.user.findUnique({ where: { id: gate.userId }, select: { factLedger: true } });
  const merged = mergeFacts(sanitizeFacts(existing?.factLedger), sanitizeFacts(input));
  await prisma.user.update({
    where: { id: gate.userId },
    data: { factLedger: merged as unknown as Prisma.InputJsonValue },
  });
  return { ok: true };
}
