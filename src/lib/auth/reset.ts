import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db/prisma";

/** How long a reset link stays valid. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/** SHA-256 hex of a raw token — only the hash is ever stored. */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Issue a single-use reset token for a user. Any outstanding tokens for the
 * same user are revoked first (one live link at a time). Returns the RAW token
 * to email; the DB only keeps its hash.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });
  return raw;
}

/**
 * Validate and consume a raw reset token. Returns the userId on success and
 * deletes the token (single use). Returns null when missing, expired or unknown.
 */
export async function consumePasswordResetToken(raw: string): Promise<string | null> {
  if (!raw) return null;
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(raw) },
  });
  if (!record) return null;

  // Always remove the record once looked up, valid or not.
  await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => {});

  if (record.expiresAt.getTime() < Date.now()) return null;
  return record.userId;
}
