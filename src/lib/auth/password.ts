import bcrypt from "bcryptjs";

/** Minimum password length accepted at signup. */
export const MIN_PASSWORD_LENGTH = 10;

/**
 * A small blocklist of the most common / breached passwords and obvious
 * keyboard patterns. These are rejected regardless of length so that values
 * like "12345678", "password1" or "qwertyuiop" can never be used.
 */
const COMMON_PASSWORDS = new Set([
  "password", "passw0rd", "password1", "password123", "12345678", "123456789",
  "1234567890", "qwertyuiop", "qwerty123", "11111111", "00000000", "iloveyou",
  "admin123", "letmein1", "welcome1", "welcome123", "abc12345", "aaaaaaaa",
  "1q2w3e4r", "zxcvbnm1", "trustno1", "monkey12", "dragon123", "sunshine1",
  "football1", "baseball1", "princess1", "superman1", "google123", "orire123",
]);

/** True when the string is a monotonic run like "123456" or "abcdef". */
function isSequential(s: string): boolean {
  if (s.length < 6) return false;
  let up = true;
  let down = true;
  for (let i = 1; i < s.length; i++) {
    const d = s.charCodeAt(i) - s.charCodeAt(i - 1);
    if (d !== 1) up = false;
    if (d !== -1) down = false;
  }
  return up || down;
}

/** Count the distinct character classes present (lower/upper/digit/symbol). */
function characterClasses(s: string): number {
  let n = 0;
  if (/[a-z]/.test(s)) n++;
  if (/[A-Z]/.test(s)) n++;
  if (/\d/.test(s)) n++;
  if (/[^a-zA-Z0-9]/.test(s)) n++;
  return n;
}

/**
 * Validate password strength. Returns an error string (shown verbatim to the
 * user) or null when the password is strong enough. The rules are intentionally
 * strict enough to reject weak values like "12345678" or "password" while
 * staying memorable-passphrase friendly (length can substitute for symbols).
 *
 * Accepted when: at least MIN_PASSWORD_LENGTH chars, not a common/breached
 * password, not a single repeated character or a simple sequence, not purely
 * numeric, doesn't contain the account's email name, and uses either two+
 * character classes or is a long (16+) passphrase.
 */
export function validatePassword(password: string, email?: string): string | null {
  const pw = password;
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (pw.length > 200) {
    return "Password is too long (max 200 characters).";
  }
  const lower = pw.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) {
    return "That password is too common. Choose something harder to guess.";
  }
  if (/^(.)\1+$/.test(pw)) {
    return "Password can’t be a single repeated character.";
  }
  if (isSequential(lower)) {
    return "Password can’t be a simple sequence like “123456” or “abcdef”.";
  }
  if (/^\d+$/.test(pw)) {
    return "Password can’t be all numbers — add letters or symbols.";
  }
  if (email) {
    const local = email.split("@")[0]?.toLowerCase();
    if (local && local.length >= 3 && lower.includes(local)) {
      return "Password can’t contain your email name.";
    }
  }
  if (characterClasses(pw) < 2 && pw.length < 16) {
    return "Use a mix of letters and numbers (or a longer passphrase of 16+ characters).";
  }
  return null;
}

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
  return validatePassword(password, email);
}
