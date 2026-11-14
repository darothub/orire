import { NextResponse } from "next/server";
import { requireOccAccess } from "@/lib/occ/requireAccess";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export async function GET() {
  const access = await requireOccAccess();
  if (!access) return NextResponse.json({ error: "Not available" }, { status: 403 });
  const runs = await prisma.occAdviceRun.findMany({
    where: { userId: access.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ runs }, { headers: { "Cache-Control": "private, no-store" } });
}
