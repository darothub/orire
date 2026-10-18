import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
const isEmailVerified = vi.fn();

vi.mock("./auth", () => ({ auth: (...args: unknown[]) => auth(...args) }));
vi.mock("./verify", () => ({
  isEmailVerified: (...args: unknown[]) => isEmailVerified(...args),
}));

import { requireVerifiedAction, requireVerifiedUser } from "./guard";

describe("requireVerifiedUser", () => {
  beforeEach(() => {
    auth.mockReset();
    isEmailVerified.mockReset();
  });

  it("rejects signed-out callers with 401 + UNAUTHENTICATED", async () => {
    auth.mockResolvedValue(null);
    const gate = await requireVerifiedUser("upload a CV");
    expect(gate).toEqual({
      ok: false,
      status: 401,
      code: "UNAUTHENTICATED",
      message: "Sign in to upload a CV.",
    });
    expect(isEmailVerified).not.toHaveBeenCalled();
  });

  it("rejects unverified accounts with 403 + EMAIL_UNVERIFIED", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    isEmailVerified.mockResolvedValue(false);
    const gate = await requireVerifiedUser("download your CV");
    expect(gate).toEqual({
      ok: false,
      status: 403,
      code: "EMAIL_UNVERIFIED",
      message:
        "Verify your email to download your CV. Check your inbox for the verification link, or resend it from the banner.",
    });
  });

  it("allows verified users", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    isEmailVerified.mockResolvedValue(true);
    await expect(requireVerifiedUser()).resolves.toEqual({ ok: true, userId: "u1" });
  });
});

describe("requireVerifiedAction", () => {
  beforeEach(() => {
    auth.mockReset();
    isEmailVerified.mockReset();
  });

  it("maps codes to action reasons", async () => {
    auth.mockResolvedValue(null);
    await expect(requireVerifiedAction("save")).resolves.toMatchObject({
      ok: false,
      reason: "not-signed-in",
    });

    auth.mockResolvedValue({ user: { id: "u2" } });
    isEmailVerified.mockResolvedValue(false);
    await expect(requireVerifiedAction("save")).resolves.toMatchObject({
      ok: false,
      reason: "email-unverified",
    });

    isEmailVerified.mockResolvedValue(true);
    await expect(requireVerifiedAction("save")).resolves.toEqual({ ok: true, userId: "u2" });
  });
});
