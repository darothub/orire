/**
 * Access gates for product features. Signed-in users with an **unverified**
 * email may browse; they may not upload, download, cloud-save, spend AI, or
 * start checkout until email is verified. Real enforcement is server-side —
 * client UX (useWriteGate / VerifyBanner) only explains the block.
 */
import { auth } from "./auth";
import { isEmailVerified } from "./verify";

export type GateCode = "UNAUTHENTICATED" | "EMAIL_UNVERIFIED";

export type UserGate =
  | { ok: true; userId: string }
  | { ok: false; status: number; message: string; code: GateCode };

export type ActionGate =
  | { ok: true; userId: string }
  | { ok: false; reason: "not-signed-in" | "email-unverified"; message: string };

function messageFor(action: string, code: GateCode): string {
  if (code === "UNAUTHENTICATED") {
    return `Sign in to ${action}.`;
  }
  return `Verify your email to ${action}. Check your inbox for the verification link, or resend it from the banner.`;
}

/**
 * API-route gate: signed-in + email verified. `action` is the human phrase in
 * error copy (e.g. "upload a CV", "run the assistant").
 */
export async function requireVerifiedUser(action = "use this feature"): Promise<UserGate> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHENTICATED",
      message: messageFor(action, "UNAUTHENTICATED"),
    };
  }
  if (!(await isEmailVerified(userId))) {
    return {
      ok: false,
      status: 403,
      code: "EMAIL_UNVERIFIED",
      message: messageFor(action, "EMAIL_UNVERIFIED"),
    };
  }
  return { ok: true, userId };
}

/**
 * Server-action gate with stable `reason` codes the client can branch on.
 */
export async function requireVerifiedAction(action = "use this feature"): Promise<ActionGate> {
  const gate = await requireVerifiedUser(action);
  if (gate.ok) return { ok: true, userId: gate.userId };
  return {
    ok: false,
    reason: gate.code === "UNAUTHENTICATED" ? "not-signed-in" : "email-unverified",
    message: gate.message,
  };
}
