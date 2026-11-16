import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireOccAccess } from "@/lib/occ/requireAccess";

export const runtime = "nodejs";
const send = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "private, no-store" },
});
type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const access = await requireOccAccess();
  if (!access) return send({ error: "Not available" }, 403);
  const { id } = await params;
  if (id.length > 100) return send({ error: "Not found" }, 404);
  const conversation = await prisma.occConversation.findFirst({
    where: { id, userId: access.userId },
    select: { id: true, title: true, primaryAgent: true, usedAgents: true,
      messages: { orderBy: { sequence: "asc" }, select: { id: true, sender: true, text: true, sequence: true } },
    },
  });
  if (!conversation) return send({ error: "Not found" }, 404);
  return send({ conversation });
}

export async function DELETE(_request: Request, { params }: Params) {
  const access = await requireOccAccess();
  if (!access) return send({ error: "Not available" }, 403);
  const { id } = await params;
  if (id.length > 100) return send({ error: "Not found" }, 404);
  const result = await prisma.occConversation.deleteMany({ where: { id, userId: access.userId } });
  if (!result.count) return send({ error: "Not found" }, 404);
  return send({ deleted: true });
}
