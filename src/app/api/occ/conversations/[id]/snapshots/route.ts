import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireOccAccess } from "@/lib/occ/requireAccess";
import { validateOccCoachingHistory } from "@/lib/occ/coachingHistory";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };
const send = (value: unknown, status = 200) => NextResponse.json(value, {
  status, headers: { "Cache-Control": "private, no-store" },
});

/** Saving a transcript does not authorize this route: the caller must
 * explicitly opt in again to storing CV quotes/interview answers.
 */
export async function POST(request: Request, { params }: Params) {
  const access = await requireOccAccess();
  if (!access) return send({ error: "Not available" }, 403);
  const { id } = await params;
  if (id.length > 100) return send({ error: "Not found" }, 404);
  if (Number(request.headers.get("content-length") || 0) > 120000)
    return send({ error: "Request too large" }, 413);
  const body = await request.text();
  if (body.length > 120000) return send({ error: "Request too large" }, 413);
  let raw: unknown;
  try { raw = JSON.parse(body); } catch { return send({ error: "Invalid JSON" }, 400); }
  const input = validateOccCoachingHistory(raw);
  if (!input) return send({ error: "Invalid or non-consented coaching history" }, 400);

  try {
    const saved = await prisma.$transaction(async tx => {
      const conversation = await tx.occConversation.findFirst({
        where: { id, userId: access.userId },
        select: { id: true, messages: { select: { sequence: true, sender: true, text: true } } },
      });
      if (!conversation) return null;
      const bySequence = new Map(conversation.messages.map(msg => [msg.sequence, msg]));
      const valid = input.snapshots.every(({ messageSequence, kind }) => {
        const turn = bySequence.get(messageSequence);
        if (!turn || turn.sender !== "OCC") return false;
        // Typed cards can only attach to the correct type of assistant turn.
        if (kind === "review") return turn.text.includes("reviewed the supplied CV");
        const answerTurn = bySequence.get(messageSequence - 1);
        const stored = input.snapshots.find(item => item.messageSequence === messageSequence);
        return turn.text.startsWith("Feedback on your answer") &&
          answerTurn?.sender === "you" &&
          stored?.payload.kind === "interview" &&
          answerTurn.text === stored.payload.answer;
      });
      if (!valid) return false;
      // Replace as one atomic consented set to avoid stale associations.
      await tx.occCoachingSnapshot.deleteMany({ where: { conversationId: conversation.id } });
      await tx.occCoachingSnapshot.createMany({
        data: input.snapshots.map(snapshot => ({
          conversationId: conversation.id,
          messageSequence: snapshot.messageSequence,
          schemaVersion: 1,
          kind: snapshot.kind,
          payload: JSON.parse(JSON.stringify(snapshot.payload)) as Prisma.InputJsonValue,
        })),
      });
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (saved === null) return send({ error: "Conversation not found" }, 404);
    if (saved === false) return send({ error: "Transcript changed; save it before saving results" }, 409);
    return send({ saved: input.snapshots.length, consented: true });
  } catch {
    return send({ error: "Could not save coaching history" }, 503);
  }
}

/** Forget all structured coaching results independently of the transcript. */
export async function DELETE(_request: Request, { params }: Params) {
  const access = await requireOccAccess();
  if (!access) return send({ error: "Not available" }, 403);
  const { id } = await params;
  if (id.length > 100) return send({ error: "Not found" }, 404);
  const existing = await prisma.occConversation.findFirst({
    where: { id, userId: access.userId }, select: { id: true },
  });
  if (!existing) return send({ error: "Not found" }, 404);
  await prisma.occCoachingSnapshot.deleteMany({ where: { conversationId: existing.id } });
  return send({ deleted: true });
}
