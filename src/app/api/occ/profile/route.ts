import { NextResponse } from "next/server";
import { requireOccAccess } from "@/lib/occ/requireAccess";
import { prisma } from "@/lib/db/prisma";
import { validateCareerProfile } from "@/lib/occ/profile";

export const runtime = "nodejs";
const send = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET() {
  const access = await requireOccAccess();
  if (!access) return send({ error: "Not available" }, 403);
  const profile = await prisma.occCareerProfile.findUnique({ where: { userId: access.userId } });
  return send({ profile });
}
export async function PUT(request: Request) {
  const access = await requireOccAccess();
  if (!access) return send({ error: "Not available" }, 403);
  if (Number(request.headers.get("content-length") || "0") > 5000) return send({ error: "Request too large" }, 413);
  let raw: unknown;
  try { raw = await request.json(); } catch { return send({ error: "Invalid JSON" }, 400); }
  const profile = validateCareerProfile(raw);
  if (!profile) return send({ error: "Invalid career profile" }, 400);
  const saved = await prisma.occCareerProfile.upsert({
    where: { userId: access.userId },
    create: { userId: access.userId, ...profile },
    update: profile,
  });
  return send({ profile: saved });
}
export async function DELETE() {
  const access = await requireOccAccess();
  if (!access) return send({ error: "Not available" }, 403);
  await prisma.occCareerProfile.deleteMany({ where: { userId: access.userId } });
  return send({ deleted: true });
}
