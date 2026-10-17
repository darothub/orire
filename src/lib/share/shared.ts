import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { CVData } from "@/lib/cv/schema";

export interface SharedCV {
  name: string;
  template: string;
  data: CVData;
}

/**
 * Public read of a shared CV by token — no auth. Returns null for an unknown or
 * revoked token. Only the CV content the owner chose to publish is exposed;
 * nothing about the account travels with it.
 */
export async function getSharedCV(token: string): Promise<SharedCV | null> {
  const t = token?.trim();
  if (!t) return null;
  const doc = await prisma.document.findFirst({
    where: { shareToken: t },
    select: { title: true, template: true, data: true },
  });
  if (!doc) return null;
  const data = doc.data as unknown as CVData;
  return { name: (data.basics?.fullName || doc.title || "CV").trim(), template: doc.template, data };
}
