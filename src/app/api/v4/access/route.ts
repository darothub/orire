import { NextResponse } from "next/server";
import { requireV4User } from "@/lib/v4/access";

/** Tells the home page whether to send this signed-in person to /app. Same gate as every v4 page. */
export async function GET() {
  const enabled = Boolean(await requireV4User());
  return NextResponse.json({ enabled }, { headers: { "Cache-Control": "private, no-store" } });
}
