import "server-only";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { requireVerifiedUser } from "@/lib/auth/guard";
import { occFeatureEnabled } from "@/lib/occ/access";
import { getPlanId } from "@/lib/entitlement/entitlement";
import { requireOccAccess } from "@/lib/occ/requireAccess";
import { v4EmailAllowed, v4Enabled } from "./flags";

/**
 * Who may use v4. Accounts that already have the Career Copilot beta keep
 * their access. Everyone else gets in when ORIRE_V4_ENABLED is on, they have a
 * verified email, and (if ORIRE_V4_BETA_EMAILS is set) their email is listed.
 * Returns null for anyone else. Use this in every v4 page and every API route
 * a v4 page calls; UI visibility is not security.
 */
export async function requireV4User(): Promise<{ userId: string } | null> {
  const occ = await requireOccAccess();
  if (occ) return occ;
  if (!v4Enabled()) return null;
  const gate = await requireVerifiedUser("use Orire");
  if (!gate.ok) return null;
  const session = await auth();
  return v4EmailAllowed(session?.user?.email) ? { userId: gate.userId } : null;
}

/** The AI Copilot parts need the OCC switch too, which stays an owner decision (see docs/occ-m8-release-readiness.md). */
export const v4AiEnabled = () => occFeatureEnabled();

export async function requireV4Access(): Promise<void> {
  if (!(await requireV4User())) notFound();
}

/**
 * For the Career Copilot services (review, match, saved chats): a v4 account on the Career plan,
 * with the OCC switch on. Replaces the OCC beta email list for v4 so the rollout is one decision.
 */
export async function requireV4Career(): Promise<{ userId: string } | null> {
  if (!v4AiEnabled()) return null;
  const user = await requireV4User();
  if (!user) return null;
  return (await getPlanId(user.userId)) === "career" ? user : null;
}

export const v4Metadata = (title: string) => ({
  title: `${title} (v4) | Orire`,
  robots: { index: false, follow: false },
});
