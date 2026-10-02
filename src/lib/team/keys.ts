/**
 * orire — pooled team provider keys (Phase B3b).
 *
 * Owner/admins store a provider API key once; seated members then run premium
 * models on it without a personal key. Secrets are encrypted at rest via
 * `secretBox` and the plaintext only ever leaves this module through
 * `resolvePooledKeyForSession`, which the AI routes call server-side. The client
 * never receives ciphertext or plaintext — only masked labels and which
 * providers are pooled.
 *
 * Server-only (imports prisma + node crypto).
 */

import { prisma } from "@/lib/db/prisma";
import { needsKey, type ProviderId } from "@/lib/ai/types";
import { canManageTeam, type TeamRole } from "@/lib/team/policy";
import { maskSecret, open, seal, secretBoxConfigured } from "@/lib/crypto/secretBox";
import type { TeamOpResult } from "@/lib/team/team";

/** Providers that accept a pooled BYO key (CLI logins are excluded). */
const POOLABLE: ProviderId[] = ["openai", "anthropic"];

export interface PooledKeyDTO {
  provider: ProviderId;
  label: string; // masked hint, never the secret
  updatedAt: string;
  setByName: string | null; // who last set it (audit); null if unknown
}

function isPoolable(p: string): p is ProviderId {
  return (POOLABLE as string[]).includes(p) && needsKey(p as ProviderId);
}

async function membershipOf(userId: string) {
  return prisma.teamMember.findUnique({ where: { userId } });
}

/** Masked pooled keys for the caller's team (any seated member may view). */
export async function listTeamKeys(userId: string): Promise<PooledKeyDTO[]> {
  const membership = await membershipOf(userId);
  if (!membership) return [];
  const keys = await prisma.teamKey.findMany({
    where: { teamId: membership.teamId },
    orderBy: { provider: "asc" },
  });
  const poolable = keys.filter((k) => isPoolable(k.provider));

  // Resolve who set each key for an audit line (createdById has no relation).
  const setterIds = [...new Set(poolable.map((k) => k.createdById))];
  const setters = setterIds.length
    ? await prisma.user.findMany({
        where: { id: { in: setterIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const nameById = new Map(setters.map((u) => [u.id, u.name || u.email || null]));

  return poolable.map((k) => ({
    provider: k.provider as ProviderId,
    label: k.label ?? "•••",
    updatedAt: k.updatedAt.toISOString(),
    setByName: nameById.get(k.createdById) ?? null,
  }));
}

/** ProviderIds the caller's team has a pooled key for (client run-gating). */
export async function pooledProvidersFor(userId: string): Promise<ProviderId[]> {
  const membership = await membershipOf(userId);
  if (!membership) return [];
  const keys = await prisma.teamKey.findMany({
    where: { teamId: membership.teamId },
    select: { provider: true },
  });
  return keys.map((k) => k.provider).filter(isPoolable);
}

/** Set (upsert) a pooled key for a provider. Owner/admin only. */
export async function setTeamKey(userId: string, provider: string, secret: string): Promise<TeamOpResult> {
  if (!secretBoxConfigured()) {
    return { ok: false, error: "Server isn't configured for pooled keys (missing ORIRE_SECRET_KEY)." };
  }
  if (!isPoolable(provider)) {
    return { ok: false, error: "That provider can't use a pooled key." };
  }
  const clean = secret.trim();
  if (clean.length < 8) return { ok: false, error: "That key looks too short." };

  const membership = await membershipOf(userId);
  if (!membership || !canManageTeam(membership.role as TeamRole)) {
    return { ok: false, error: "Only owners and admins can manage pooled keys." };
  }

  const sealed = seal(clean);
  await prisma.teamKey.upsert({
    where: { teamId_provider: { teamId: membership.teamId, provider } },
    create: {
      teamId: membership.teamId,
      provider,
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      tag: sealed.tag,
      label: maskSecret(clean),
      createdById: userId,
    },
    update: {
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      tag: sealed.tag,
      label: maskSecret(clean),
    },
  });
  return { ok: true };
}

/** Remove a pooled key. Owner/admin only. */
export async function removeTeamKey(userId: string, provider: string): Promise<TeamOpResult> {
  const membership = await membershipOf(userId);
  if (!membership || !canManageTeam(membership.role as TeamRole)) {
    return { ok: false, error: "Only owners and admins can manage pooled keys." };
  }
  await prisma.teamKey
    .delete({ where: { teamId_provider: { teamId: membership.teamId, provider } } })
    .catch(() => undefined); // already gone is fine
  return { ok: true };
}

/**
 * Resolve the plaintext pooled key for a signed-in member + provider, or null.
 * SERVER-ONLY: the AI routes call this when a request carries no personal key.
 * Returns null (never throws) so a decryption/config failure just means "no
 * pooled key available" and the route falls back to its missing-key error.
 */
export async function resolvePooledKeyForSession(
  userId: string,
  provider: ProviderId
): Promise<string | null> {
  if (!isPoolable(provider) || !secretBoxConfigured()) return null;
  const membership = await membershipOf(userId);
  if (!membership) return null;
  const row = await prisma.teamKey.findUnique({
    where: { teamId_provider: { teamId: membership.teamId, provider } },
  });
  if (!row) return null;
  try {
    return open({ ciphertext: row.ciphertext, iv: row.iv, tag: row.tag });
  } catch {
    return null;
  }
}
