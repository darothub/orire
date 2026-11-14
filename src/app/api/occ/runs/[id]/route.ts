import { NextResponse } from "next/server";
import { requireOccAccess } from "@/lib/occ/requireAccess";
import { prisma } from "@/lib/db/prisma";
export const runtime = "nodejs";

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireOccAccess();
  if (!access) return NextResponse.json({ error: "Not available" }, { status: 403 });
  const { id } = await ctx.params;
  if (id.length > 100 || !id) return NextResponse.json({ error: "Invalid run" }, { status: 400 });
  const result = await prisma.occAdviceRun.deleteMany({ where: { id, userId: access.userId } });
  if (!result.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "private, no-store" } });
}
