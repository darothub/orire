/**
 * orire — pooled team key server actions (Phase B3b).
 *
 * Client-facing wrappers for managing a team's pooled provider keys. The caller
 * is always re-derived from the session; secrets flow in but never back out
 * (only masked labels and the set of pooled providers are returned).
 */

"use server";

import { auth } from "@/lib/auth/auth";
import type { ProviderId } from "@/lib/ai/types";
import type { TeamOpResult } from "@/lib/team/team";
import {
  listTeamKeys,
  pooledProvidersFor,
  removeTeamKey,
  setTeamKey,
  type PooledKeyDTO,
} from "@/lib/team/keys";

const NOT_SIGNED_IN: TeamOpResult = { ok: false, error: "Sign in first." };

/** Masked pooled keys for the caller's team (for the management UI). */
export async function listTeamKeysAction(): Promise<PooledKeyDTO[]> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return [];
  return listTeamKeys(userId);
}

/** Providers the caller's team has a pooled key for (client run-gating). */
export async function pooledKeyProviders(): Promise<ProviderId[]> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return [];
  return pooledProvidersFor(userId);
}

export async function setTeamKeyAction(provider: string, secret: string): Promise<TeamOpResult> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return NOT_SIGNED_IN;
  return setTeamKey(userId, provider, secret);
}

export async function removeTeamKeyAction(provider: string): Promise<TeamOpResult> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return NOT_SIGNED_IN;
  return removeTeamKey(userId, provider);
}
