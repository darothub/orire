import "server-only";
import { auth } from "@/lib/auth/auth";
import { getPlanId } from "@/lib/entitlement/entitlement";
import { canAccessOcc, occFeatureEnabled } from "./access";

/**
 * Authoritative OCC authorization. Invoke from EVERY OCC server entrypoint,
 * including route handlers and server actions. UI visibility is not security.
 */
export async function requireOccAccess(): Promise<{ userId: string } | null> {
  // Avoid DB/authorization work when the kill switch is off.
  if (!occFeatureEnabled()) return null;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const plan = await getPlanId(userId);
  if (!canAccessOcc(plan)) return null;
  return { userId };
}
