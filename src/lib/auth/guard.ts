/**
 * Access gate for AI routes that spend Orire's managed provider keys. Requires
 * a signed-in, email-verified user so anonymous or throwaway accounts can't
 * consume paid AI budget. Returns a typed result the caller maps onto its own
 * response envelope.
 */
import { auth } from "./auth";
import { isEmailVerified } from "./verify";

export type UserGate =
  | { ok: true; userId: string }
  | { ok: false; status: number; message: string };

export async function requireVerifiedUser(): Promise<UserGate> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return { ok: false, status: 401, message: "Sign in to run the assistant." };
  }
  if (!(await isEmailVerified(userId))) {
    return {
      ok: false,
      status: 403,
      message: "Verify your email to run the assistant. Check your inbox for the verification link.",
    };
  }
  return { ok: true, userId };
}
