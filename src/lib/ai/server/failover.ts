/**
 * orire — managed-provider failover for auto-routed AI tasks.
 *
 * Tasks like simulate / cover-letter / retone / evidence / judge are routed to
 * a provider server-side (see providerRouter); the provider is an internal,
 * hidden implementation detail, not a user choice. So if the primary provider
 * is unavailable (outage, 5xx, 429, timeout, network), we transparently retry
 * the same prompt on the other managed provider and serve that instead —
 * instead of surfacing "assistant is down" to the user.
 *
 * We fail over ONLY on availability failures. A 4xx (bad request, auth, a
 * plan/validation error) is deterministic — the other provider would reject it
 * too — so we return it immediately without a wasted second call.
 *
 * Refine is intentionally NOT routed through here: it is gated by a signed run
 * token that authorizes specific user-selected providers, so its failover is a
 * separate concern.
 */

import { runProvider, type ProviderCall, type CallOpts } from "@/lib/ai/server/providerCall";
import { serverKeyFor, notConfiguredMessage } from "@/lib/ai/server/serverKey";
import { routeTask, routeFallback, type AiTaskType } from "@/lib/ai/server/providerRouter";
import type { ProviderId } from "@/lib/ai/types";
import { logger } from "@/lib/obs/logger";

export interface ServedCall {
  call: ProviderCall;
  /** The provider that actually served (or last attempted) the task. */
  provider: ProviderId;
  model: string;
  /** True when the primary was down and the fallback served the result. */
  fellBack: boolean;
  /** True when no managed provider has a key configured. */
  noKey?: boolean;
}

const AVAILABILITY_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);

/**
 * Whether a failed call is worth retrying on the other provider: transport
 * errors/timeouts (no status) and transient/5xx statuses. A deterministic 4xx
 * is not.
 */
export function isAvailabilityFailure(call: ProviderCall): boolean {
  if (call.ok) return false;
  if (call.status == null) return true;
  return AVAILABILITY_STATUS.has(call.status);
}

/**
 * Run an auto-routed task with managed-provider failover. Tries the primary
 * route; on an availability failure, tries the other provider (when it has a
 * key). Returns which provider actually served it.
 */
export async function runRoutedWithFailover(
  task: AiTaskType,
  args: { system: string; user: string; opts?: CallOpts },
): Promise<ServedCall> {
  const primary = routeTask(task);
  const fallback = routeFallback(task);
  const chain = [primary, fallback].filter((c) => serverKeyFor(c.provider) !== null);

  if (chain.length === 0) {
    return {
      call: { ok: false, status: 503, body: notConfiguredMessage(primary.provider) },
      provider: primary.provider,
      model: primary.model,
      fellBack: false,
      noKey: true,
    };
  }

  let last: ServedCall | null = null;
  for (let i = 0; i < chain.length; i++) {
    const cand = chain[i];
    const call = await runProvider({
      provider: cand.provider,
      apiKey: serverKeyFor(cand.provider) ?? "",
      model: cand.model,
      system: args.system,
      user: args.user,
      opts: args.opts,
    });
    const fellBack = cand.provider !== primary.provider;
    if (call.ok) {
      if (fellBack) logger.warn("ai.failover.served", { task, from: primary.provider, to: cand.provider });
      return { call, provider: cand.provider, model: cand.model, fellBack };
    }
    last = { call, provider: cand.provider, model: cand.model, fellBack };
    const hasNext = i < chain.length - 1;
    if (!hasNext) break;
    if (!isAvailabilityFailure(call)) break; // deterministic failure — don't burn the fallback
    logger.warn("ai.failover.retrying", { task, from: cand.provider, to: chain[i + 1].provider, status: call.status });
  }
  return last!;
}
