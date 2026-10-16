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
 * Resolve which Document autosave should write to: the user's active-version
 * pointer when it still points at one of their rows, otherwise the
 * most-recently-updated row (back-compat for single-document users created
 * before the library). Returns null when the user has no documents yet.
 */
async function resolveActiveDocId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { activeDocumentId: true } });
  const pointer = user?.activeDocumentId ?? null;
  if (pointer) {
    const owned = await prisma.document.findFirst({ where: { id: pointer, userId }, select: { id: true } });
    if (owned) return owned.id;
  }
  const recent = await prisma.document.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { id: true } });
  return recent?.id ?? null;
}

/**
 * Persist the current working CV for the signed-in user. Writes to the user's
 * *active* library version (the editor target); if they have none yet, it
 * creates their first version. The active pointer is kept in sync so a later
 * switch to an older version doesn't silently retarget autosave.
 */
export async function saveWorkingCV(input: {
  data: CVData;
  template: string;
  baseline: CVData | null;
  title?: string;
}): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, reason: "not-signed-in" };

  const targetId = await resolveActiveDocId(userId);
  const title = input.title?.trim() || input.data.basics.fullName || "Untitled CV";
  const data = input.data as unknown as Prisma.InputJsonValue;
  const baseline = (input.baseline ?? undefined) as unknown as Prisma.InputJsonValue | undefined;

  const id = targetId
    ? (await prisma.document.update({
        where: { id: targetId },
        data: { data, template: input.template, baseline, title },
        select: { id: true },
      })).id
    : (await prisma.document.create({
        data: { userId, data, template: input.template, baseline, title },
        select: { id: true },
      })).id;

  // Keep the active pointer current (sets it the first time, or after a legacy
  // most-recent fallback made a row authoritative).
  await prisma.user.update({ where: { id: userId }, data: { activeDocumentId: id } });

  return { ok: true, id };
}

/** Load the signed-in user's active working CV, or null if none / not signed in. */
export async function loadWorkingCV(): Promise<WorkingCV | null> {
  const userId = await requireUserId();
  if (!userId) return null;

  const targetId = await resolveActiveDocId(userId);
  if (!targetId) return null;
  const doc = await prisma.document.findFirst({ where: { id: targetId, userId } });
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
