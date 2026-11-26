import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireV4User } from "@/lib/v4/access";
import { validateApplicationStatus } from "@/lib/occ/applicationSave";

export const runtime = "nodejs";

const send = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const access = await requireV4User();
  if (!access) return send({ error: "Not available" }, 403);
  const { id } = await params;
  if (id.length > 100) return send({ error: "Not found" }, 404);
  let raw: unknown;
  try { raw = await request.json(); } catch { return send({ error: "Invalid JSON" }, 400); }
  const x = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const patch: { status?: string; company?: string; role?: string; notes?: string; link?: string | null } = {};
  if ("status" in x) {
    const status = validateApplicationStatus(x.status);
    if (!status) return send({ error: "Invalid status" }, 400);
    patch.status = status;
  }
  if (typeof x.company === "string") {
    const company = x.company.trim().slice(0, 120);
    if (!company) return send({ error: "Company can't be empty" }, 400);
    patch.company = company;
  }
  if (typeof x.role === "string") patch.role = x.role.trim().slice(0, 120);
  if (typeof x.notes === "string") patch.notes = x.notes.slice(0, 2000);
  if ("link" in x) patch.link = typeof x.link === "string" && x.link.trim() ? x.link.trim().slice(0, 500) : null;
  if (Object.keys(patch).length === 0) return send({ error: "Nothing to update" }, 400);

  const result = await prisma.occApplication.updateMany({ where: { id, userId: access.userId }, data: patch });
  if (!result.count) return send({ error: "Not found" }, 404);
  return send({ updated: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const access = await requireV4User();
  if (!access) return send({ error: "Not available" }, 403);
  const { id } = await params;
  if (id.length > 100) return send({ error: "Not found" }, 404);
  const result = await prisma.occApplication.deleteMany({ where: { id, userId: access.userId } });
  if (!result.count) return send({ error: "Not found" }, 404);
  return send({ deleted: true });
}
