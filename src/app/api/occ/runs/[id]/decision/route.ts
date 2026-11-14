import { NextResponse } from "next/server";
import { requireOccAccess } from "@/lib/occ/requireAccess";
import { prisma } from "@/lib/db/prisma";
import { readDecision, updateDecision } from "@/lib/occ/decisions";

export const runtime = "nodejs";
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireOccAccess();
  if (!access) return NextResponse.json({ error: "Not available" }, { status: 403 });
  const { id } = await ctx.params;
  if (id.length > 100) return NextResponse.json({ error: "Invalid run" }, { status: 400 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  const { index, decision } = raw as Record<string, unknown>;
  const choice = readDecision(decision);
  if (typeof index !== "number" || !choice) return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  // Re-check ownership on read AND conditional write. No client-supplied advice text is trusted.
  const run = await prisma.occAdviceRun.findFirst({ where: { id, userId: access.userId } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = updateDecision(run.recommendations, index, choice);
  if (!updated) return NextResponse.json({ error: "Invalid recommendation" }, { status: 400 });
  const result = await prisma.occAdviceRun.updateMany({
    where: { id, userId: access.userId },
    data: { recommendations: updated },
  });
  if (!result.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ recommendations: updated }, { headers: { "Cache-Control": "private, no-store" } });
}
