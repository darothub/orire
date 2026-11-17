import { NextResponse } from "next/server";
import { requireOccAccess } from "@/lib/occ/requireAccess";
import { looksLikeCV } from "@/lib/occ/document-validation";
import { parseGroundedAdvice } from "@/lib/occ/recommendations";
import { runRoutedWithFailover } from "@/lib/ai/server/failover";
import { DETERMINISTIC } from "@/lib/ai/server/providerCall";
import { routeTask } from "@/lib/ai/server/providerRouter";
import { aiRateLimit } from "@/lib/ratelimit/guard";
import { bodyTooLarge } from "@/lib/ai/server/limits";
import { claimOccAiRequest, refundOccAiRequest } from "@/lib/occ/budget";

export const runtime = "nodejs";
export const maxDuration = 120;
const respond = (data: unknown, status: number) => NextResponse.json(data, {
  status, headers: { "Cache-Control": "private, no-store" },
});
const SYSTEM = [
  "You are Orire Career Copilot. Perform a GENERAL CV review, not a job-match review.",
  "Return ONLY valid JSON with keys summary, recommendations, nextSteps.",
  "Each recommendation has requirement, cvEvidence, assessment, suggestion, sampleWording, question.",
  "Use 3-5 recommendations covering clarity, structure, factual evidence, readability, and presentation.",
  "The requirement is an editorial criterion, not a fictional job requirement.",
  "Set assessment to supported only when cvEvidence is a verbatim excerpt from the CV.",
  "Use null cvEvidence and needs-clarification where evidence is missing.",
  "Never invent experience, credentials, employers, numbers, clinical facts, skills, responsibilities or accomplishments.",
  "Never assign ATS scores or hiring predictions. No automatic edits.",
  "Suggested rewriting is optional and must strictly preserve all original facts; otherwise null.",
  "Keep nextSteps to at most 3. Profession-neutral language."
].join(" ");

export async function POST(request: Request) {
  const access = await requireOccAccess();
  if (!access) return respond({ error: "Not available" }, 403);
  if (bodyTooLarge(request)) return respond({ error: "Request too large" }, 413);
  let body: unknown;
  try { body = await request.json(); } catch { return respond({ error: "Invalid JSON" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return respond({ error: "Invalid request" }, 400);
  const cv = (body as Record<string, unknown>).cv;
  if (typeof cv !== "string" || cv.length > 30000 || !looksLikeCV(cv)) {
    return respond({ error: "Attach a readable CV before requesting a general review." }, 400);
  }
  const { provider } = routeTask("agent-analyze");
  const limited = await aiRateLimit(request, provider, access.userId);
  if (limited) return limited;
  let budgetPeriod: string | null;
  try { budgetPeriod = await claimOccAiRequest(access.userId); }
  catch { return respond({ error: "OCC is temporarily unavailable." }, 503); }
  if (!budgetPeriod) return respond({ error: "Daily OCC AI allowance reached. Try tomorrow." }, 429);
  try {
    const served = await runRoutedWithFailover("agent-analyze", {
      system: SYSTEM,
      user: JSON.stringify({ task: "Review this CV's clarity, presentation and evidence without assuming a target role", cv }),
      opts: { ...DETERMINISTIC, maxTokens: 1500 },
    });
    if (!served.call.ok) {
      await refundOccAiRequest(access.userId, budgetPeriod);
      return respond({ error: "General review is temporarily unavailable." }, 503);
    }
    try {
      return respond({ advice: parseGroundedAdvice(served.call.content, cv) }, 200);
    } catch {
      await refundOccAiRequest(access.userId, budgetPeriod);
      return respond({ error: "Could not validate the review. Please retry." }, 502);
    }
  } catch {
    await refundOccAiRequest(access.userId, budgetPeriod);
    return respond({ error: "General review is temporarily unavailable." }, 503);
  }
}
