/**
 * orire — authenticated secret-box (AES-256-GCM) for secrets at rest.
 *
 * Used to encrypt pooled team provider keys (Phase B3b) before they touch the
 * database. The encryption key is derived once from `ORIRE_SECRET_KEY` (or, as a
 * fallback, `AUTH_SECRET`) via scrypt, so rotating that env value invalidates
 * all stored ciphertext — intended, since the plaintext is a third-party secret.
 *
 * Server-only: importing `node:crypto` keeps this out of any client bundle.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

export interface SealedSecret {
  ciphertext: string; // base64
  iv: string; // base64 (12 bytes)
  tag: string; // base64 (16 bytes auth tag)
}

const ALGO = "aes-256-gcm";
const FIXED_SALT = "orire.teamkey.v1"; // rotates with the secret, not per-record

let cachedKey: Buffer | null = null;

/** Derive (and cache) the 32-byte key from env. Throws if no secret is set. */
function deriveKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.ORIRE_SECRET_KEY ?? process.env.AUTH_SECRET ?? "";
  if (secret.length < 16) {
    throw new Error(
      "Pooled keys need a strong ORIRE_SECRET_KEY (or AUTH_SECRET) set to at least 16 characters."
    );
  }
  cachedKey = scryptSync(secret, FIXED_SALT, 32);
  return cachedKey;
}

/** True when an encryption secret is configured (so callers can degrade UX). */
export function secretBoxConfigured(): boolean {
  const secret = process.env.ORIRE_SECRET_KEY ?? process.env.AUTH_SECRET ?? "";
  return secret.length >= 16;
}

/** Encrypt a UTF-8 plaintext into ciphertext + iv + auth tag (all base64). */
export function seal(plaintext: string): SealedSecret {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

/** Decrypt a sealed secret back to UTF-8 plaintext. Throws on tamper/mismatch. */
export function open(sealed: SealedSecret): string {
  const key = deriveKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(sealed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

/** A short, non-reversible hint for display, e.g. `sk-…4f2a`. Never the secret. */
export function maskSecret(secret: string): string {
  const s = secret.trim();
  if (s.length <= 6) return "•••";
  return `${s.slice(0, 3)}…${s.slice(-4)}`;
}
