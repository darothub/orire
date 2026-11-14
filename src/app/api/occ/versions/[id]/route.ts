import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireOccAccess } from "@/lib/occ/requireAccess";

export const runtime = "nodejs";
const send = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

/** Undo deletes ONLY an untouched OCC-created version, never the source CV. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireOccAccess();
  if (!access) return send({ error: "Not available" }, 403);
  const { id } = await context.params;
  if (!id || id.length > 100) return send({ error: "Invalid version" }, 400);
  try {
    const result = await prisma.$transaction(async tx => {
      const record = await tx.occCvVersion.findFirst({ where: { id, userId: access.userId } });
      if (!record) return { status: 404, error: "Version not found" } as const;
      const [doc, user] = await Promise.all([
        tx.document.findFirst({ where: { id: record.documentId, userId: access.userId } }),
        tx.user.findUnique({ where: { id: access.userId }, select: { activeDocumentId: true } }),
      ]);
      if (!doc || doc.updatedAt.getTime() !== record.savedUpdatedAt.getTime() ||
          user?.activeDocumentId === record.documentId) {
        return { status: 409, error: "Version changed or is active. Use the Library to manage it." } as const;
      }
      await tx.document.delete({ where: { id: doc.id } });
      await tx.occCvVersion.delete({ where: { id: record.id } });
      return { deleted: true } as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return "error" in result ? send({ error: result.error }, result.status) : send(result);
  } catch {
    return send({ error: "Could not undo the saved version. Please refresh." }, 503);
  }
}
