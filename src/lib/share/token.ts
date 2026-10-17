import { randomBytes } from "crypto";

/**
 * A URL-safe, unguessable share token (~128 bits). Public CV links are
 * unlisted-by-obscurity: anyone with the link can view, so the token must be
 * long and random, not sequential.
 */
export function newShareToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Build the absolute public URL for a share token. */
export function shareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/cv/${token}`;
}
