import { NextResponse } from "next/server";
import { requireVerifiedUser } from "@/lib/auth/guard";
import { occFeatureEnabled } from "@/lib/occ/access";
import { consume, getPlanId, refund } from "@/lib/entitlement/entitlement";
import { runRoutedWithFailover } from "@/lib/ai/server/failover";
import { DETERMINISTIC } from "@/lib/ai/server/providerCall";
import { fakeAiFor, fakeChatReply } from "@/lib/ai/server/fakeProvider";
import { aiRateLimit } from "@/lib/ratelimit/guard";
import { routeTask } from "@/lib/ai/server/providerRouter";
import { bodyTooLarge } from "@/lib/ai/server/limits";
import { gateChatReply, type ChatStore } from "@/lib/occ/chatGate";
import { CHAT_SYSTEM, chatUserPrompt, parseChatInput, parseChatReply } from "@/lib/occ/chat";

export const runtime = "nodejs";
export const maxDuration = 60;
const NO_STORE = { "Cache-Control": "private, no-store" };
const chatStore: ChatStore = {
  getPlan: getPlanId,
  consume: (u, plan) => consume(u, "chat", plan),
  refund: (u, plan) => refund(u, "chat", plan),
};
const respond = (body: unknown, status: number) => NextResponse.json(body, { status, headers: NO_STORE });

/**
 * A Copilot reply for a message no keyword matched. Every signed-in, verified user
 * may chat; each plan has its own reply allowance, and a failed reply gives it back.
 */
export async function POST(req: Request) {
  if (!occFeatureEnabled()) return respond({ error: "Not available" }, 403);
  const access = await requireVerifiedUser("use the Copilot");
  if (!access.ok) return respond({ error: access.message }, access.status);
  if (bodyTooLarge(req)) return respond({ error: "Request too large" }, 413);
  const { provider } = routeTask("chat");
  const limited = await aiRateLimit(req, provider, access.userId);
  if (limited) return limited;
  let raw: unknown;
  try { raw = await req.json(); } catch { return respond({ error: "Invalid JSON" }, 400); }
  const input = parseChatInput(raw);
  if (!input) return respond({ error: "Send a short message to the Copilot." }, 400);

  const run = await gateChatReply(access.userId, chatStore);
  if (!run.ok) return respond({ error: run.error, code: "no-runs" }, run.status);

  try {
    let content: string;
    if (fakeAiFor("openai") || fakeAiFor("anthropic")) {
      content = fakeChatReply(input.message);
    } else {
      const served = await runRoutedWithFailover("chat", {
        system: CHAT_SYSTEM,
        user: chatUserPrompt(input),
        opts: { ...DETERMINISTIC, maxTokens: 500 },
      });
      if (!served.call.ok) {
        await run.undo();
        return respond({ error: "The Copilot is unavailable right now. Try again in a moment." }, 503);
      }
      content = served.call.content;
    }
    const reply = parseChatReply(content);
    if (!reply) {
      await run.undo();
      return respond({ error: "The Copilot could not answer that. Try rephrasing." }, 502);
    }
    return respond(reply, 200);
  } catch {
    await run.undo();
    return respond({ error: "The Copilot is unavailable right now. Try again in a moment." }, 503);
  }
}
