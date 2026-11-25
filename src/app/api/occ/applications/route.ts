import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireOccAccess } from "@/lib/occ/requireAccess";
import { validateApplicationInput } from "@/lib/occ/applicationSave";

export const runtime = "nodejs";

const send = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

const SELECT = {
  id: true, company: true, role: true, status: true, link: true, notes: true, documentId: true, updatedAt: true,
} as const;

/** The signed-in user's application board (never other users'). */
export async function GET() {
  const access = await requireOccAccess();
  if (!access) return send({ error: "Not available" }, 403);
  const applications = await prisma.occApplication.findMany({
    where: { userId: access.userId },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: SELECT,
  });
  return send({ applications });
}

export async function POST(request: Request) {
  const access = await requireOccAccess();
  if (!access) return send({ error: "Not available" }, 403);
  let raw: unknown;
  try { raw = await request.json(); } catch { return send({ error: "Invalid JSON" }, 400); }
  const data = validateApplicationInput(raw);
  if (!data) return send({ error: "A company name is required." }, 400);
  const count = await prisma.occApplication.count({ where: { userId: access.userId } });
  if (count >= 200) return send({ error: "You've reached the application limit (200)." }, 409);
  const application = await prisma.occApplication.create({
    data: { userId: access.userId, ...data },
    select: SELECT,
  });
  return send({ application }, 201);
}
