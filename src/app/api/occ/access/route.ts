import { NextResponse } from "next/server";
import { requireOccAccess } from "@/lib/occ/requireAccess";

export async function GET() {
  const permitted = Boolean(await requireOccAccess());
  return NextResponse.json({ permitted }, { headers: { "Cache-Control": "private, no-store" } });
}
