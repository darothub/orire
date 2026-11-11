import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db/prisma";

/** How long a sign-in link stays valid. */
export const MAGIC_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

/** SHA-256 hex of a raw token — only the hash is ever stored. */
function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Issue a single-use sign-in token for an email. Outstanding tokens for the
 * same address are revoked first (one live link at a time). Returns the RAW
 * token to email; the DB only keeps its hash.
 */
export async function createMagicLinkToken(email: string): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.magicLinkToken.deleteMany({ where: { email } });
  await prisma.magicLinkToken.create({
    data: {
      email,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + MAGIC_TOKEN_TTL_MS),
    },
  });
  return raw;
}

/**
 * Validate and consume a raw token. Returns the email on success and deletes
 * the token (single use); null when missing, expired or unknown.
 */
export async function consumeMagicLinkToken(raw: string): Promise<string | null> {
  if (!raw) return null;
  const record = await prisma.magicLinkToken.findUnique({
    where: { tokenHash: hashToken(raw) },
  });
  if (!record) return null;

  // Always remove the record once looked up, valid or not.
  await prisma.magicLinkToken.delete({ where: { id: record.id } }).catch(() => {});

  if (record.expiresAt.getTime() < Date.now()) return null;
  return record.email;
}
