import { NextResponse } from "next/server";
import { requireOccAccess } from "@/lib/occ/requireAccess";
import { analyzeEvidence } from "@/lib/occ/match";

export async function POST(request: Request) {
  const access = await requireOccAccess();
  if (!access) return NextResponse.json({ error: "Not available" }, { status: 403 });
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "CV and job description required" }, { status: 400 });
  }
  const { cv, description } = payload as Record<string, unknown>;
  if (typeof cv !== "string" || typeof description !== "string" ||
      cv.trim().length < 30 || description.trim().length < 30 ||
      cv.length > 30000 || description.length > 15000) {
    return NextResponse.json({ error: "Provide CV text (30–30,000 characters) and a job description (30–15,000 characters)." }, { status: 400 });
  }
  return NextResponse.json(analyzeEvidence(cv, description), {
    headers: { "Cache-Control": "no-store" },
  });
}
