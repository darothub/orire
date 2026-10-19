/**
 * orire — profile & activity server actions.
 *
 * `getProfile` gathers the signed-in user's identity, lifetime activity
 * (refines, exports, best rating) and current subscription into one payload for
 * the Profile workspace. The plan block is read live from the Entitlement row,
 * which the Stripe webhook keeps current, so it reflects plan changes with no
 * extra sync step. `recordExport` persists one row per successful PDF export so
 * the exports stat survives across devices (History is client-only).
 */

"use server";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import {
  getEntitlementSummary,
  getEntitlementRow,
  getPlanId,
  getUsed,
  consume,
} from "@/lib/entitlement/entitlement";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { PLANS, meterFor, withinCap, type PlanId } from "@/lib/plan/plan";
import { isEmailVerified } from "@/lib/auth/verify";
import { ratingStats } from "@/lib/profile/activity";

export interface ProfileUser {
  name: string | null;
  email: string | null;
  emailVerified: boolean;
  image: string | null;
  memberSince: string; // ISO
}

export interface ProfilePlan {
  id: PlanId;
  label: string;
  status: string | null;
  renewsAt: string | null; // ISO or null
  canManage: boolean;
  usedThisMonth: number;
  cap: number | null;
}

export interface ProfileActivity {
  totalRefines: number;
  exportCount: number;
  bestRating: number | null;
  bestImprovement: number | null;
  lastRefineAt: string | null;
  lastExportAt: string | null;
}

export interface ProfileData {
  user: ProfileUser;
  plan: ProfilePlan;
  activity: ProfileActivity;
}

export interface ProfileResult {
  data?: ProfileData;
  error?: string;
}

/** Load everything the Profile workspace renders for the signed-in user. */
export async function getProfile(): Promise<ProfileResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Sign in to view your profile." };

  const [user, runs, totalRefines, exportCount, lastExport, summary, row] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, emailVerified: true, image: true, createdAt: true },
    }),
    prisma.refineRun.findMany({
      where: { userId },
      select: { ratingBefore: true, ratingAfter: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.refineRun.count({ where: { userId } }),
    prisma.exportEvent.count({ where: { userId } }),
    prisma.exportEvent.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    getEntitlementSummary(userId),
    getEntitlementRow(userId),
  ]);

  if (!user) return { error: "Account not found." };

  const stats = ratingStats(runs);
  const canManage = isStripeConfigured() && Boolean(row?.stripeCustomerId);

  return {
    data: {
      user: {
        name: user.name,
        email: user.email,
        emailVerified: Boolean(user.emailVerified),
        image: user.image,
        memberSince: user.createdAt.toISOString(),
      },
      plan: {
        id: summary.plan,
        label: PLANS[summary.plan].label,
        status: row?.status ?? null,
        renewsAt: row?.currentPeriodEnd?.toISOString() ?? null,
        canManage,
        usedThisMonth: summary.usedThisMonth,
        cap: summary.cap,
      },
      activity: {
        totalRefines,
        exportCount,
        bestRating: stats.bestRating,
        bestImprovement: stats.bestImprovement,
        lastRefineAt: runs[0]?.createdAt.toISOString() ?? null,
        lastExportAt: lastExport?.createdAt.toISOString() ?? null,
      },
    },
  };
}

export interface ExportAuthz {
  ok: boolean;
  plan: PlanId;
  /** Downloads used after this authorization (the consumed count). */
  used: number;
  /** Download cap for the plan (null = unlimited). */
  cap: number | null;
  block?: { title: string; body: string };
}

/**
 * Authorize (and, for metered plans, consume) one download BEFORE the client
 * builds the PDF. This is the enforceable download gate: Free gets a lifetime
 * cap of 3, paid is unlimited. Server-authoritative (UsageCounter) so it can't
 * be reset from the client (point 13).
 *
 * The PDF is produced client-side, so the server can't observe build success;
 * the client pre-checks that the CV is present before calling this, which keeps
 * the only realistic failure from ever spending a credit. Consumption is atomic
 * here so the cap can't be bypassed.
 */
export async function authorizeExport(): Promise<ExportAuthz> {
  const freeCap = meterFor("free", "download").cap;
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return {
      ok: false,
      plan: "free",
      used: 0,
      cap: freeCap,
      block: { title: "Sign in to download", body: "Create a free account to download your CV as a PDF." },
    };
  }
  // Hermetic E2E: no DB entitlement row — allow unlimited downloads for the
  // minted Playwright user only (ORIRE_E2E_BYPASS=1).
  const { isE2eBypassUser } = await import("@/lib/e2e/bypass");
  if (isE2eBypassUser(userId)) {
    return { ok: true, plan: "career", used: 0, cap: null };
  }
  if (!(await isEmailVerified(userId))) {
    return {
      ok: false,
      plan: "free",
      used: 0,
      cap: freeCap,
      block: {
        title: "Verify your email",
        body: "Check your inbox for the verification link, then download. You can resend it from your account menu.",
      },
    };
  }

  const plan = await getPlanId(userId);
  const used = await getUsed(userId, "download", plan);
  const cap = meterFor(plan, "download").cap;
  const gate = withinCap(plan, "download", used);
  if (!gate.allowed) {
    return {
      ok: false,
      plan,
      used,
      cap,
      block: { title: "Download limit reached", body: gate.reason ?? "Upgrade to Pro for unlimited downloads." },
    };
  }

  const newUsed = cap !== null ? await consume(userId, "download", plan) : used;
  return { ok: true, plan, used: newUsed, cap };
}

export interface RecordExportInput {
  format?: string;
  template?: string | null;
  company?: string | null;
}

/**
 * Record one successful export. Best-effort and silent: a signed-out user or a
 * transient write failure must never block the actual download.
 */
export async function recordExport(input: RecordExportInput = {}): Promise<{ ok: boolean }> {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { ok: false };
    await prisma.exportEvent.create({
      data: {
        userId,
        format: (input.format ?? "pdf").slice(0, 16),
        template: input.template ? input.template.slice(0, 64) : null,
        company: input.company ? input.company.slice(0, 120) : null,
      },
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
