import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireOccAccess } from "@/lib/occ/requireAccess";
import { validateOccConversationSave } from "@/lib/occ/conversationSave";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
const send = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "private, no-store" },
});

/** Only user-owned transcript metadata; never return other users' conversations. */
export async function GET() {
  const access = await requireOccAccess();
  if (!access) return send({ error: "Not available" }, 403);
  const conversations = await prisma.occConversation.findMany({
    where: { userId: access.userId },
    orderBy: { updatedAt: "desc" }, take: 50,
    select: { id: true, title: true, primaryAgent: true, usedAgents: true, updatedAt: true, createdAt: true },
  });
  return send({ conversations });
}

/** Explicit save only. CV and JD attachments are intentionally not persisted. */
export async function POST(request: Request) {
  const access = await requireOccAccess();
  if (!access) return send({ error: "Not available" }, 403);
  if (Number(request.headers.get("content-length") || "0") > 80000)
    return send({ error: "Request too large" }, 413);
  const rawText = await request.text();
  if (rawText.length > 80000) return send({ error: "Request too large" }, 413);
  let raw: unknown;
  try { raw = JSON.parse(rawText); } catch { return send({ error: "Invalid JSON" }, 400); }
  const data = validateOccConversationSave(raw);
  if (!data) return send({ error: "Invalid conversation" }, 400);
  try {
    const conversation = await prisma.$transaction(async tx => {
      if (data.id) {
        const existing = await tx.occConversation.findFirst({
          where: { id: data.id, userId: access.userId },
          select: { id: true },
        });
        if (!existing) return null;
        await tx.occConversation.update({
          where: { id: existing.id },
          data: { title: data.title, primaryAgent: data.primaryAgent, usedAgents: data.usedAgents },
        });
        await tx.occMessage.deleteMany({ where: { conversationId: existing.id } });
        await tx.occMessage.createMany({ data: data.turns.map((t, i) => ({
          conversationId: existing.id, sender: t.role, text: t.text,
          sequence: i, agentId: t.role === "OCC" ? data.primaryAgent : null,
        })) });
        return existing;
      }
      const created = await tx.occConversation.create({
        data: { userId: access.userId, title: data.title, primaryAgent: data.primaryAgent,
          usedAgents: data.usedAgents,
          messages: { create: data.turns.map((t, i) => ({
            sender: t.role, text: t.text, sequence: i,
            agentId: t.role === "OCC" ? data.primaryAgent : null,
          })) },
        }, select: { id: true },
      });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!conversation) return send({ error: "Conversation not found" }, 404);
    return send({ id: conversation.id, saved: true }, data.id ? 200 : 201);
  } catch {
    return send({ error: "Could not save the conversation" }, 503);
  }
}
