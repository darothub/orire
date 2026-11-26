import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireV4Career } from "@/lib/v4/access";
import { validateOccCoachingSnapshot } from "@/lib/occ/coachingSnapshot";

export const runtime = "nodejs";
const send = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "private, no-store" },
});
type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const access = await requireV4Career();
  if (!access) return send({ error: "Not available" }, 403);
  const { id } = await params;
  if (id.length > 100) return send({ error: "Not found" }, 404);
  const conversation = await prisma.occConversation.findFirst({
    where: { id, userId: access.userId },
    select: { id: true, title: true, primaryAgent: true, usedAgents: true, cvDocumentId: true, jobDescription: true,
      messages: { orderBy: { sequence: "asc" }, select: { id: true, sender: true, text: true, sequence: true } },
      coachingSnapshots: { orderBy: { messageSequence: "asc" }, take: 40, select: { messageSequence: true, schemaVersion: true, kind: true, payload: true, consentedAt: true } },
    },
  });
  if (!conversation) return send({ error: "Not found" }, 404);
  const snapshots = conversation.coachingSnapshots.flatMap(record => {
    if (record.schemaVersion !== 1) return [];
    const parsed = validateOccCoachingSnapshot(record.payload, true);
    return parsed && parsed.kind === record.kind
      ? [{ messageSequence: record.messageSequence, payload: parsed, consentedAt: record.consentedAt }]
      : [];
  });
  // The CV comes from the user's own library, and only if it still exists.
  const cv = conversation.cvDocumentId
    ? await prisma.document.findFirst({
        where: { id: conversation.cvDocumentId, userId: access.userId },
        select: { id: true, title: true, company: true, template: true, data: true, updatedAt: true },
      })
    : null;
  const { cvDocumentId, jobDescription, ...rest } = conversation;
  return send({
    conversation: { ...rest, coachingSnapshots: snapshots },
    context: { jobDescription, cvDocumentId, cv: cv ? { ...cv, updatedAt: cv.updatedAt.toISOString() } : null },
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const access = await requireV4Career();
  if (!access) return send({ error: "Not available" }, 403);
  const { id } = await params;
  if (id.length > 100) return send({ error: "Not found" }, 404);
  const result = await prisma.occConversation.deleteMany({ where: { id, userId: access.userId } });
  if (!result.count) return send({ error: "Not found" }, 404);
  return send({ deleted: true });
}
