"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import type { CVData } from "@/lib/cv/schema";
import type { Prisma } from "@prisma/client";

export interface WorkingCV {
  id: string;
  title: string;
  template: string;
  data: CVData;
  baseline: CVData | null;
  updatedAt: string;
}

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Persist the current working CV for the signed-in user. B0 keeps a single
 * working document per user (the most-recently-updated row); multi-document
 * management can layer on later without a schema change.
 */
export async function saveWorkingCV(input: {
  data: CVData;
  template: string;
  baseline: CVData | null;
  title?: string;
}): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, reason: "not-signed-in" };

  const existing = await prisma.document.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  const title = input.title?.trim() || input.data.basics.fullName || "Untitled CV";
  const data = input.data as unknown as Prisma.InputJsonValue;
  const baseline = (input.baseline ?? undefined) as unknown as Prisma.InputJsonValue | undefined;

  const saved = existing
    ? await prisma.document.update({
        where: { id: existing.id },
        data: { data, template: input.template, baseline, title },
        select: { id: true },
      })
    : await prisma.document.create({
        data: { userId, data, template: input.template, baseline, title },
        select: { id: true },
      });

  return { ok: true, id: saved.id };
}

/** Load the signed-in user's working CV, or null if none / not signed in. */
export async function loadWorkingCV(): Promise<WorkingCV | null> {
  const userId = await requireUserId();
  if (!userId) return null;

  const doc = await prisma.document.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  if (!doc) return null;

  return {
    id: doc.id,
    title: doc.title,
    template: doc.template,
    data: doc.data as unknown as CVData,
    baseline: (doc.baseline ?? null) as unknown as CVData | null,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Record a completed refine/compare run for history (company-grouped audit). */
export async function saveRefineRun(input: {
  company?: string;
  jobDescription: string;
  provider: string;
  model?: string;
  result: CVData;
  ratingBefore?: number;
  ratingAfter?: number;
}): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false };

  await prisma.refineRun.create({
    data: {
      userId,
      company: input.company,
      jobDescription: input.jobDescription,
      provider: input.provider,
      model: input.model,
      resultData: input.result as unknown as Prisma.InputJsonValue,
      ratingBefore: input.ratingBefore,
      ratingAfter: input.ratingAfter,
    },
  });
  return { ok: true };
}
