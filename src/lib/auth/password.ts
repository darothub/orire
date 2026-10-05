import bcrypt from "bcryptjs";

/** Minimum password length accepted at signup. */
export const MIN_PASSWORD_LENGTH = 8;

/** Hash a plaintext password for storage. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/** Compare a plaintext password against a stored hash. */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Loose e-mail shape check (real validation happens at send/verify time). */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate a signup payload. Returns an error string (shown verbatim to the
 * user) or null when the input is acceptable.
 */
export function validateCredentials(email: string, password: string): string | null {
  if (!isValidEmail(email)) return "Please enter a valid email address.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
