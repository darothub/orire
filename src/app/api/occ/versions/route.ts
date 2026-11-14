import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { CVData } from "@/lib/cv/schema";
import { prisma } from "@/lib/db/prisma";
import { requireOccAccess } from "@/lib/occ/requireAccess";
import { parseCvField, patchCvField } from "@/lib/occ/versionPatch";

export const runtime = "nodejs";
const send = (data: unknown, status = 200) => NextResponse.json(data, {
  status, headers: { "Cache-Control": "private, no-store" },
});

export async function GET() {
  const access = await requireOccAccess();
  if (!access) return send({ error: "Not available" }, 403);
  const documents = await prisma.document.findMany({
    where: { userId: access.userId },
    orderBy: { updatedAt: "desc" }, take: 50,
    select: { id: true, title: true, company: true, template: true, data: true, updatedAt: true },
  });
  return send({ documents: documents.map(d => ({
    ...d, updatedAt: d.updatedAt.toISOString(),
  })) });
}

export async function POST(request: Request) {
  const access = await requireOccAccess();
  if (!access) return send({ error: "Not available" }, 403);
  if (Number(request.headers.get("content-length") || "0") > 7000) return send({ error: "Request too large" }, 413);
  let raw: unknown;
  try { raw = await request.json(); } catch { return send({ error: "Invalid JSON" }, 400); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return send({ error: "Invalid request" }, 400);
  const body = raw as Record<string, unknown>;
  const field = parseCvField(body.field);
  const { sourceId, expectedUpdatedAt, expectedText, replacement } = body;
  if (!field || typeof sourceId !== "string" || sourceId.length > 100 ||
      typeof expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(expectedUpdatedAt)) ||
      typeof expectedText !== "string" || expectedText.length > 1500 ||
      typeof replacement !== "string" || replacement.length > 1500) return send({ error: "Invalid change" }, 400);

  try {
    const created = await prisma.$transaction(async tx => {
      const source = await tx.document.findFirst({ where: { id: sourceId, userId: access.userId } });
      if (!source) return { error: "Source CV not found", status: 404 } as const;
      if (source.updatedAt.toISOString() !== expectedUpdatedAt) {
        return { error: "This CV has changed since you opened it. Reload before saving.", status: 409 } as const;
      }
      const original = source.data as unknown as CVData;
      const revised = patchCvField(original, field, expectedText, replacement);
      if (!revised) return { error: "The original passage no longer matches. Reload and review again.", status: 409 } as const;
      const saved = await tx.document.create({
        data: {
          userId: access.userId, title: `${source.title} (OCC revision)`,
          company: source.company, template: source.template,
          data: revised as unknown as Prisma.InputJsonValue,
          baseline: source.data as Prisma.InputJsonValue,
          lastExportedAt: null, shareToken: null,
        },
        select: { id: true, updatedAt: true },
      });
      const tracked = await tx.occCvVersion.create({
        data: {
          userId: access.userId, sourceDocumentId: source.id,
          documentId: saved.id, savedUpdatedAt: saved.updatedAt,
        },
      });
      return { id: saved.id, undoId: tracked.id } as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if ("error" in created) return send({ error: created.error }, created.status);
    return send({ ...created, message: "New private CV version saved. Original CV and active editor remain unchanged." }, 201);
  } catch {
    return send({ error: "Could not save the version. Please retry after refreshing." }, 503);
  }
}
