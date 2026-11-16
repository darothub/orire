import "server-only";
import { auth } from "@/lib/auth/auth";
import { getPlanId } from "@/lib/entitlement/entitlement";
import { prisma } from "@/lib/db/prisma";
import { canAccessOcc, occBetaEmailAllowed, occFeatureEnabled, occIsolatedE2eFixtureAllowed } from "./access";

/**
 * Authoritative OCC authorization. Invoke from EVERY OCC server entrypoint,
 * including route handlers and server actions. UI visibility is not security.
 */
export async function requireOccAccess(): Promise<{ userId: string } | null> {
  // Avoid DB/authorization work when the kill switch is off.
  if (!occFeatureEnabled()) return null;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !session?.user?.email) return null;
  // A signed but stale JWT must not keep beta access after the account email
  // changes. Check the canonical stored identity before applying the allowlist.
  const user = await prisma.user.findUnique({
    where: { id: userId }, select: { email: true },
  });
  const sessionEmail = session.user.email.trim().toLowerCase();
  const accountEmail = user?.email?.trim().toLowerCase();
  if (!accountEmail || sessionEmail !== accountEmail) return null;
  if (!(occBetaEmailAllowed(accountEmail) ||
        occIsolatedE2eFixtureAllowed(userId, accountEmail))) return null;
  const plan = await getPlanId(userId);
  if (!canAccessOcc(plan)) return null;
  return { userId };
}
