"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import type { CVData } from "@/lib/cv/schema";
import type { Prisma } from "@prisma/client";

/**
 * Server actions for the cloud-backed CV version library (Story 2). Each
 * version is a `Document` row; the user's `activeDocumentId` points at the one
 * open in the editor (the autosave target — see actions/cv.ts). All mutations
 * are ownership-scoped (`where: { id, userId }`), so a client can never read or
 * change another user's rows.
 */

export interface LibraryVersion {
  id: string;
  title: string;
  company: string | null;
  template: string;
  data: CVData;
  baseline: CVData | null;
  lastExportedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

type DocRow = {
  id: string;
  title: string;
  company: string | null;
  template: string;
  data: unknown;
  baseline: unknown;
  lastExportedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toVersion(doc: DocRow): LibraryVersion {
  return {
    id: doc.id,
    title: doc.title,
    company: doc.company ?? null,
    template: doc.template,
    data: doc.data as CVData,
    baseline: (doc.baseline ?? null) as CVData | null,
    lastExportedAt: doc.lastExportedAt ? doc.lastExportedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** List every saved version for the user, newest-updated first, plus the active id. */
export async function listVersions(): Promise<{ versions: LibraryVersion[]; activeId: string | null }> {
  const userId = await requireUserId();
  if (!userId) return { versions: [], activeId: null };

  const [docs, user] = await Promise.all([
    prisma.document.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } }),
    prisma.user.findUnique({ where: { id: userId }, select: { activeDocumentId: true } }),
  ]);
  return { versions: (docs as DocRow[]).map(toVersion), activeId: user?.activeDocumentId ?? null };
}

/** Create a new version. Becomes the active version unless `makeActive` is false. */
export async function createVersion(input: {
  title: string;
  company?: string | null;
  template: string;
  data: CVData;
  baseline: CVData | null;
  exported?: boolean;
  makeActive?: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, reason: "not-signed-in" };

  const created = await prisma.document.create({
    data: {
      userId,
      title: input.title.trim() || input.data.basics.fullName || "Untitled version",
      company: input.company?.trim() || null,
      template: input.template,
      data: input.data as unknown as Prisma.InputJsonValue,
      baseline: (input.baseline ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      lastExportedAt: input.exported ? new Date() : null,
    },
    select: { id: true },
  });

  if (input.makeActive !== false) {
    await prisma.user.update({ where: { id: userId }, data: { activeDocumentId: created.id } });
  }
  return { ok: true, id: created.id };
}

/** Rename / re-file a version (metadata only). */
export async function updateVersionMeta(
  id: string,
  patch: { title?: string; company?: string | null },
): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false };

  const data: { title?: string; company?: string | null } = {};
  if (patch.title !== undefined) data.title = patch.title.trim() || "Untitled version";
  if (patch.company !== undefined) data.company = patch.company?.trim() || null;
  if (Object.keys(data).length === 0) return { ok: true };

  const res = await prisma.document.updateMany({ where: { id, userId }, data });
  return { ok: res.count > 0 };
}

/** Duplicate a version as a new "(copy)". Does not change the active pointer. */
export async function duplicateVersion(id: string): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, reason: "not-signed-in" };

  const src = await prisma.document.findFirst({ where: { id, userId } });
  if (!src) return { ok: false, reason: "not-found" };

  const copy = await prisma.document.create({
    data: {
      userId,
      title: `${src.title} (copy)`,
      company: src.company,
      template: src.template,
      data: src.data as unknown as Prisma.InputJsonValue,
      baseline: (src.baseline ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      lastExportedAt: null,
    },
    select: { id: true },
  });
  return { ok: true, id: copy.id };
}

/** Delete a version. If it was active, repoint to the most-recent remaining row. */
export async function deleteVersion(id: string): Promise<{ ok: boolean; activeId: string | null }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, activeId: null };

  const res = await prisma.document.deleteMany({ where: { id, userId } });
  if (res.count === 0) return { ok: false, activeId: null };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { activeDocumentId: true } });
  let activeId = user?.activeDocumentId ?? null;
  if (activeId === id) {
    const next = await prisma.document.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" }, select: { id: true } });
    activeId = next?.id ?? null;
    await prisma.user.update({ where: { id: userId }, data: { activeDocumentId: activeId } });
  }
  return { ok: true, activeId };
}

/** Set which version is active (the editor / autosave target). */
export async function setActiveVersion(id: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false };

  const owned = await prisma.document.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return { ok: false };
  await prisma.user.update({ where: { id: userId }, data: { activeDocumentId: id } });
  return { ok: true };
}

/** Mark a version as exported just now (called from the export flow). */
export async function markVersionExported(id: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false };
  const res = await prisma.document.updateMany({ where: { id, userId }, data: { lastExportedAt: new Date() } });
  return { ok: res.count > 0 };
}
