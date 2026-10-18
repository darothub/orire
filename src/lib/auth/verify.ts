import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db/prisma";

/** How long an email-verification link stays valid. */
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** SHA-256 hex of a raw token — only the hash is ever stored. */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Issue a single-use email-verification token for a user. Any outstanding
 * tokens for the same user are revoked first (one live link at a time).
 * Returns the RAW token to email; the DB only keeps its hash.
 */
export async function createEmailVerificationToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
    },
  });
  return raw;
}

/**
 * Validate and consume a raw verification token. On success marks the user's
 * email as verified, deletes the token (single use) and returns the userId.
 * Returns null when missing, expired or unknown.
 */
export async function consumeEmailVerificationToken(raw: string): Promise<string | null> {
  if (!raw) return null;
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(raw) },
  });
  if (!record) return null;

  // Always remove the record once looked up, valid or not.
  await prisma.emailVerificationToken.delete({ where: { id: record.id } }).catch(() => {});

  if (record.expiresAt.getTime() < Date.now()) return null;

  await prisma.user.update({
    where: { id: record.userId },
    data: { emailVerified: new Date() },
  });
  return record.userId;
}

/** Whether the given user has a verified email address. */
export async function isEmailVerified(userId: string): Promise<boolean> {
  // Hermetic Playwright session (no DB row) — see src/lib/e2e/bypass.ts.
  const { isE2eBypassUser } = await import("@/lib/e2e/bypass");
  if (isE2eBypassUser(userId)) return true;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });
  return Boolean(user?.emailVerified);
}
