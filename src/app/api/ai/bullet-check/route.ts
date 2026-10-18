/**
 * orire — on-demand bullet quality review (Node runtime).
 *
 * The semantic layer of the content-quality coach: judges a single bullet's
 * verb strength + relevance, spelling and impact, and proposes a fact-grounded
 * rewrite. Auto-routed server-side (hidden provider) with managed-provider
 * failover; the dev mock serves it with no key.
 */

import { NextResponse } from "next/server";
import { type ProviderId } from "@/lib/ai/types";
import { DETERMINISTIC } from "@/lib/ai/server/providerCall";
import { serverKeyFor, notConfiguredMessage } from "@/lib/ai/server/serverKey";
import { fakeAiFor, fakeBulletReview } from "@/lib/ai/server/fakeProvider";
import { routeTask } from "@/lib/ai/server/providerRouter";
import { runRoutedWithFailover } from "@/lib/ai/server/failover";
import {
  BULLET_REVIEW_SYSTEM,
  buildBulletReviewPrompt,
  parseBulletReview,
  groundSuggestion,
  type BulletReview,
} from "@/lib/ai/bulletReview";
import { aiRateLimit } from "@/lib/ratelimit/guard";
import { requireVerifiedUser } from "@/lib/auth/guard";
import { bodyTooLarge, validateInputSize } from "@/lib/ai/server/limits";

export const runtime = "nodejs";

interface Body {
  text?: string;
  role?: string;
}

type Resp = { ok: true; review: BulletReview } | { ok: false; error: string };

const json = (error: string, status = 200) => NextResponse.json({ ok: false, error } as Resp, { status });

export async function POST(req: Request) {
  const { provider } = routeTask("bullet-review") as { provider: ProviderId };

  const oversize = bodyTooLarge(req);
  if (oversize) return json(oversize, 413);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json("Invalid request body.", 400);
  }
  const text = (body.text ?? "").trim();
  if (!text) return json("Nothing to review.", 400);
  const sizeErr = validateInputSize({ text });
  if (sizeErr) return json(sizeErr, 413);

  const gate = await requireVerifiedUser();
  const limited = await aiRateLimit(req, provider, gate.ok ? gate.userId : null);
  if (limited) return limited;
  if (!gate.ok) return json(gate.message, gate.status);

  if (!fakeAiFor(provider) && !serverKeyFor("openai") && !serverKeyFor("anthropic")) {
    return json(notConfiguredMessage(provider));
  }

  try {
    let content: string;
    if (fakeAiFor(provider)) {
      content = fakeBulletReview(text);
    } else {
      const served = await runRoutedWithFailover("bullet-review", {
        system: BULLET_REVIEW_SYSTEM,
        user: buildBulletReviewPrompt(text, body.role),
        opts: { ...DETERMINISTIC, maxTokens: 700 },
      });
      if (!served.call.ok) return json(served.call.body);
      content = served.call.content;
    }
    const review = parseBulletReview(content);
    // Fact-grounding guard: never surface a rewrite that invented a number.
    review.suggestion = groundSuggestion(text, review.suggestion);
    return NextResponse.json({ ok: true, review } as Resp, { status: 200 });
  } catch (e) {
    return json(e instanceof Error ? e.message : "Couldn’t review the bullet.");
  }
}
