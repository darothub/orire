/**
 * orire — effective provider key resolver (Phase B3b, server-only).
 *
 * The AI routes accept a personal BYO key on the request. When none is present,
 * a signed-in member may still run on their team's pooled key. This resolves
 * that: personal key if given, else the session's team pooled key, else "".
 * Keeping it in one place means every AI route gains pooled-key support
 * identically, and the plaintext secret never crosses back to the client.
 */

import { auth } from "@/lib/auth/auth";
import { needsKey, type ProviderId } from "@/lib/ai/types";
import { resolvePooledKeyForSession } from "@/lib/team/keys";

export async function effectiveProviderKey(
  provider: ProviderId,
  bodyApiKey: string
): Promise<string> {
  const personal = (bodyApiKey ?? "").trim();
  if (personal) return personal;
  if (!needsKey(provider)) return "";
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return "";
  return (await resolvePooledKeyForSession(userId, provider)) ?? "";
}
